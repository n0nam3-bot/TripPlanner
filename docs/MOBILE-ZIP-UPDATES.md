# Mobile ZIP updates

## One-time setup

The importer must exist in the repository before it can process the first ZIP.

1. Open the repository in your phone's browser.
2. Use **Add file → Create new file**.
3. Set the filename to `.github/workflows/import-project-zip.yml`.
4. Paste the contents of the supplied `import-project-zip.yml` workflow file and commit it to the branch you use (normally `main`).
5. The starter ZIP also contains this workflow, but the first copy must be installed manually because an action cannot run before it exists in the repository.

## Every later update

1. Open the repository root in the mobile browser.
2. Choose **Add file → Upload files**.
3. Upload the project `.zip` directly into the repository root (not inside a subfolder).
4. Commit the upload.
5. Open **Actions → Import project ZIP** to watch the run.
6. When successful, the action unpacks files into their normal folders, removes the ZIP from the current repository files, and creates a commit. If Vercel is connected to the repository, the extracted commit should start a deployment.

If the action fails, the ZIP is left in place. Open the failed run in Actions to read the error. You can also use **Actions → Import project ZIP → Run workflow** and enter the exact ZIP filename to retry it.

## Safety and behavior

- Only `.zip` files uploaded at the repository root trigger the importer. This keeps the workflow from reacting to unrelated archives elsewhere.
- A ZIP may contain files directly at its root or one enclosing project folder such as `tripfinder-starter/`; the importer strips that one wrapper folder.
- Existing files at matching paths are overwritten; new files are added at their archive paths.
- This is an overlay import. Files absent from the ZIP are not deleted, to avoid removing work when an update contains only selected files.
- `.github/`, `.git/`, dependency/build folders, real `.env` files, and private-key/certificate files are not extracted.
- The archive is deleted from the latest working tree after successful extraction. Git still retains its earlier upload commit in repository history, so avoid repeatedly uploading unnecessarily large ZIPs.
- The workflow uses the automatically provided `GITHUB_TOKEN`; no personal access token, Neon credential or other secret is needed for the import action.
- The workflow needs repository write permission. Branch protection rules that prohibit GitHub Actions from pushing directly can block the final commit.
- Never place API keys, passwords, customer data or other secrets inside an uploaded ZIP.
