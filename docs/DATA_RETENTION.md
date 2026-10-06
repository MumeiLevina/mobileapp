# Data retention and deletion

This is the current technical behavior. It does not promise a backup-deletion deadline that has not been configured with the hosting providers.

| Data                          | Current retention                                                         | User control                       |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------- |
| Profile and preferences       | Until account deletion                                                    | Profile edit; account deletion     |
| Mood entries                  | Until account deletion                                                    | Account deletion                   |
| Conversations and messages    | Until explicit conversation/all-conversation deletion or account deletion | Delete one/all conversations       |
| Journals                      | Until explicit journal/all-journal deletion or account deletion           | Delete one/all journals            |
| Memories and embeddings       | Until explicit memory/all-memory deletion or account deletion             | Edit, approve, delete one/all      |
| Self-care sessions and garden | Until account deletion                                                    | Account deletion                   |
| Weekly reflections            | Until account deletion                                                    | Account deletion                   |
| Notification preferences      | Until account deletion                                                    | Disable/edit; account deletion     |
| Export audit metadata         | Until account deletion                                                    | Account deletion                   |
| Native/web drafts             | Until save/discard, logout or account deletion                            | Explicit discard, logout, deletion |
| Structured operational logs   | Hosting configuration is not yet finalized                                | Operator process required          |

Explicit user deletion uses hard deletion for the selected private content. `deleted_at` columns support internal recovery-compatible schema behavior, but no user recovery interface or automatic soft-delete retention workflow is exposed. Account deletion removes the Auth user and cascades application rows, including export audits.

Database backups, point-in-time recovery snapshots and third-party provider logs can outlive the live row. Before beta, operators must configure and publish the actual backup expiry, log retention, restore restrictions and deletion-request handling period. Restoring a backup must include a process to reapply deletion requests before making the restored environment active.

There is currently no scheduled age-based purge for active user content and no automatic export-audit purge before account deletion. Add retention jobs only after the product policy defines concrete periods; do not silently delete journals, conversations or memories while the user expects them to remain.
