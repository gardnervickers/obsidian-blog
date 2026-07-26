# Gardner Vickers' blog

This is a Quartz site generated from explicitly public notes in the Obsidian
vault at `/Users/gardnervickers/Documents/General`.

## Write

Create posts under `Blog/` in Obsidian. A note is eligible for publication only
when its frontmatter contains:

```yaml
publish: true
```

Both conditions are required: the note must be inside `Blog/`, and it must opt
in with `publish: true`. Linked local images and PDFs are copied alongside the
post. Nothing else in the vault is copied into this repository.

The vault template `templates/Blog Post.md` contains the standard frontmatter.
New posts default to `publish: false`. Notes can remain in `Blog/Drafts` after
publication; the sync step gives them a clean public path under `/posts/`.

## Preview

From this repository:

```sh
nix run .#preview
```

This refreshes the public content snapshot and opens a development server at
<http://localhost:8080>. Stop it with Ctrl-C.

## Validate

```sh
nix run .#check
```

## Publish

After reviewing the preview:

```sh
nix run .#publish
```

This refreshes the public snapshot, builds it, checks the diff, commits the
result, and pushes it.

The repository starts private and the Pages workflow starts as manual-only.
When the site is ready to launch, make the repository public (or use a GitHub
plan that supports Pages for private repositories), enable Pages, and add the
documented `push` trigger for `main` in `.github/workflows/deploy.yml`.

To use a different vault temporarily, set `OBSIDIAN_VAULT`:

```sh
OBSIDIAN_VAULT=/path/to/vault nix run .#preview
```
