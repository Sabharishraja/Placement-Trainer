# Security Specification - Placement Coding Tracker

## Data Invariants
1. A student's progress belongs strictly to that student's UID.
2. Companies and Questions are managed only by the Admin.
3. Students can only update their own `solvedQuestions` and `revisionNeeded` arrays.
4. User records in Firestore cannot have the role 'admin' set by the client.

## The "Dirty Dozen" Payloads (Testing Denials)
1. **Identity Spoofing**: Attempt to update another user's `solvedQuestions`.
2. **Privilege Escalation**: Attempt to create a user with `role: 'admin'`.
3. **Admin Bypass**: Attempt to create a document in `companies` without being the admin.
4. **Data Poisoning**: Attempt to set `difficulty` to 'Impossible'.
5. **ID Poisoning**: Attempt to create a question with a 1MB string as a Document ID.
6. **State Shortcut**: Attempt to update `solvedQuestions` with a boolean instead of a list of strings.
7. **PII Leak**: Attempt to read all users' information from the `users` collection.
8. **Resource Exhaustion**: Attempt to add 10,000 strings to `solvedQuestions`.
9. **Orphaned Writes**: Attempt to add a question for a non-existent `companyId`.
10. **Immutable Field Change**: Attempt to change a user's `username` after creation.
11. **Timestamp Spoofing**: Attempt to set a custom `createdAt` time.
12. **Null Field Injection**: Attempt to create a question with missing `title`.

## Test Runner Plan
Using the internal Firebase testing tools to ensure `PERMISSION_DENIED` on all of the above.
