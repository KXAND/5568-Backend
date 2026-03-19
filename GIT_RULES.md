# Git Rules

Read this file before you start coding in this repository.

Ask AI and learn Git Here: [learngitbranching](https://learngitbranching.js.org/?locale=zh_CN)

## Team Rules (Must Follow)

1. Pull the latest code before starting work: `git pull`.
2. Create your own branch for each task. Do not work directly on `master`.
3. Keep each commit focused on one kind of change. Do not mix feature logic, docs, generated files, dependency files, or temporary local convenience changes in one commit.
4. Local generated outputs or temporary debug/demo convenience changes must not remain in code that is going to be merged into `master`.
5. Only commit lock files when you intentionally changed dependencies, and commit that change separately.
6. Do not change public function behavior in a way that conflicts with the API documentation. This includes permissions, risk checks, return values, and expected side effects.
7. Do not modify/delete other people's valid comments, and do not make unnecessary edits that do not improve logic, safety, readability, or documentation.
8. Write clear commit messages, using `Conventional Commits` format (`type(scope): summary`).
9. Run compile before pushing.
10. Never force-push (`git push --force`) to shared branches.
11. Resolve conflicts locally and verify the project still runs before pushing.
12. If a change affects shared files, notify the team in chat before large edits.
