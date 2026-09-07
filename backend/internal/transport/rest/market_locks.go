package rest

import "sync"

// marketLockRegistry implements Tier 1 of the two-tier concurrency architecture
// defined in ARCHITECTURE.md §8.1: an in-process mutex per market that serializes
// order and cash-out execution before requests reach PostgreSQL.
//
// Rationale: under SERIALIZABLE isolation, a transaction that blocks on a row
// lock held by another transaction is aborted with SQLSTATE 40001 when the
// holder commits, forcing the blocked request into a full retry (new snapshot,
// new Neon round-trips). Under heavy same-market contention this creates an
// abort/retry storm. Serializing same-market mutations in-process removes the
// common contention case entirely; Tier 2 (SELECT ... FOR UPDATE row locks)
// still guards against cross-process races.
type marketLockRegistry struct {
	mu    sync.Mutex
	locks map[string]*marketLockEntry
}

type marketLockEntry struct {
	mu   sync.Mutex
	refs int
}

func newMarketLockRegistry() *marketLockRegistry {
	return &marketLockRegistry{locks: make(map[string]*marketLockEntry)}
}

// acquire locks the given market key and returns the unlock function.
// The registry entry is ref-counted so the map does not grow unbounded.
func (r *marketLockRegistry) acquire(key string) func() {
	r.mu.Lock()
	entry, ok := r.locks[key]
	if !ok {
		entry = &marketLockEntry{}
		r.locks[key] = entry
	}
	entry.refs++
	r.mu.Unlock()

	entry.mu.Lock()

	var once sync.Once
	return func() {
		once.Do(func() {
			entry.mu.Unlock()
			r.mu.Lock()
			entry.refs--
			if entry.refs == 0 {
				delete(r.locks, key)
			}
			r.mu.Unlock()
		})
	}
}
