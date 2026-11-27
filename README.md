# Vault Branch Sync

Sync notes and attachments between desktop and mobile through a private GitHub repository. Each device keeps a local copy for offline writing. You choose when to receive changes or send a Git commit. [中文使用说明](README.zh-CN.md)

## Connect a vault

1. Use Obsidian 1.11.4 or later. Install **Vault Branch Sync** and enable it under **Community plugins**. To install a GitHub release manually, place its `main.js` and `manifest.json` together in `.obsidian/plugins/vault-branch-sync/`, then reload Obsidian. [Download a release](https://github.com/feichai0017/vault-branch-sync/releases/latest)
2. Create a **private** GitHub repository for the vault, or choose an existing private repository. The default branch of an empty repository works too. To sync with a different branch, create it on GitHub first.
3. In **Settings → Vault Branch Sync**, enter `owner/repository`. Leave **Branch** blank to use the repository's default branch. Create a fine-grained GitHub token, select only this repository and grant **Contents → Read and write**. Paste the token into the plugin and select **Save connection**. [GitHub token instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
4. Select **Receive changes** on each device. The first sync downloads the branch and preserves local drafts. For an empty repository, then select **Review changes** on the device with your notes and choose the files for the first upload. A switch to another repository, branch or file scope starts with another download. For that first upload to an empty repository, GitHub initializes the branch with one selected file and commits any remaining selection in a second commit.

## Daily use

After writing, click the sync icon or run **Vault Branch Sync: Sync with GitHub**. The preview lists incoming files and local additions, edits and deletions. Select the files to commit, then choose **Apply choices**. For example, select a paper note, its figure and its index. Unchecked drafts stay on the device and appear in the next preview. **Cancel** closes the preview before any files change.

When you select a note, **Changed figures linked from selected notes** lists eligible new or edited pictures. Choose **Include figure** for each file you want. Links and embeds are resolved from the note's location. A linked Excalidraw source or SVG can also suggest its changed counterpart.

In settings, enable **Receive when opening or returning to this vault** on each device where you want it. Opening the vault or returning to the app downloads incoming changes. Independent Markdown edits merge on this device. Overlapping edits wait for your decision. **Sync status on this device** and the **Show sync status** command show the last successful sync and the latest counts. The desktop status bar also shows the time.

### Merge two edits to a note

The last synced Git blob is the common ancestor. If a laptop fixes a formula and a phone adds a paragraph, receiving combines the two changes locally. Select the resulting note in the next upload preview to publish it. In a manual sync, **Merge and commit** also lets you publish the result in the same operation.

When changes overlap, choose **Merge on this device** or **Merge and commit**. Each overlapping section shows the last synced lines, this device's lines and the GitHub lines. Choose a side for each section and select **Apply choices**. Non-overlapping edits are retained. Whole-file choices remain available for drawings, delete/edit conflicts and notes without a common version. Three-way text merging supports UTF-8 notes with consistent line endings, up to 512 KiB and 10,000 lines per version.

Choose a resolution separately for each conflict. **Compare paragraphs** shows the differing Markdown text on this device and GitHub. **Commit local version** submits the local file (or its deletion). During a receive-only sync, **Keep local change for a later commit** leaves the edit available in the next upload preview. **Use GitHub version** applies the remote change to the original path. **Keep both** keeps a local copy in `Sync conflicts/` and applies the remote version at the original path. A remote deletion moves the original to the vault trash. **Decide later** carries this conflict into the next review while other files sync. Drawings and binary attachments support keeping both copies. Text previews cover up to 512 KiB per version.

### Restore an earlier version

With a Markdown note open, run **View note history on GitHub** from the command palette or its file menu. Select **Preview** beside a commit and **Restore as a copy**. The copy is placed beside your note and includes the short commit ID in its name. Existing copies keep their contents. The history lists commits for the note's current path on the connected branch, 20 at a time. Copies remain local until you select them for a commit.

## Use the Git plugin on a desktop checkout

If the vault root is a Git checkout, enable the **Git** community plugin and turn on **Use the Git plugin on this computer** in Vault Branch Sync. The sync icon now opens Git's Source Control panel. Select a filename to see its diff. Stage individual files with **+**, run **Git: Commit staged**, then **Git: Push**. To see changes alongside an open note, run **Vault Branch Sync: View Git diff for current file**, or enable Git's editor gutter for inline change markers. [Git plugin](https://github.com/Vinzent03/obsidian-git)

**Receive changes** uses Git Pull for the checkout's active branch and configured upstream. Git controls automatic pulls on this computer. The separate GitHub connection is still used for note history. On a phone, the regular download and selective upload preview continue to use the private GitHub branch.

## What travels

- Visible vault files, including Markdown, canvases, bases and binary attachments, are eligible for sync. A root or nested `.gitignore` can exclude new local files. Previously tracked files continue to sync.
- **Include settings and themes** also transfers portable settings such as appearance and hotkeys, theme files and CSS snippets. Use the same configuration folder name across devices to share those files. Reopen the vault to apply downloaded appearance changes.
- Direct GitHub sync skips Git metadata, hidden directories, community plugin programs, plugin enable lists, plugin credentials and device workspace layouts. In desktop Git mode your checkout's tracked files, ignore rules and staging area determine what you commit.
- GitHub limits individual Git blobs to 100 MiB. This plugin uses ordinary Git blobs for attachments. Keep Git LFS material in a Git LFS workflow.

## Network and privacy

The plugin contacts `api.github.com` when you connect, sync, view note history or restore a revision. Downloads use your chosen private repository. Uploading selected files requires a manual sync. The plugin verifies downloaded Git blobs and checks the expected branch revision before updating it. A newer push triggers a fresh comparison.

Your token is kept in Obsidian's secret storage on the device. The connection and last-seen file revisions are local to the vault. The plugin has no telemetry, analytics or intermediary server.

## Development

Install Node.js 22 or later and run:

```sh
npm ci
npm test
npm run build
```

The build writes `main.js` beside `manifest.json`. Tests use disposable folders and synthetic vault files, including two-device merges, interrupted transfers, history restores and figure selection. [MIT license](LICENSE) · [node-ignore](https://github.com/kaelzhang/node-ignore) · [node-diff3](https://github.com/bhousel/node-diff3)

## Verify a release

Download `main.js` from the release you want to install, then run this command in its folder with the GitHub CLI.

```sh
gh attestation verify main.js --repo feichai0017/vault-branch-sync --signer-workflow feichai0017/vault-branch-sync/.github/workflows/release-provenance.yml --deny-self-hosted-runners
```

Publish each GitHub release with `main.js` and `manifest.json` attached. GitHub Actions rebuilds the tagged source, runs the tests, and signs the SHA-256 digest only if the build matches the published `main.js` byte for byte. To backfill a published release, run **Release provenance** from the Actions tab and enter its tag. The signed record includes the source commit used for the rebuild. [Release workflow](.github/workflows/release-provenance.yml)
