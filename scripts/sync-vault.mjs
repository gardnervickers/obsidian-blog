import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import YAML from "yaml"

const repoRoot = path.resolve(import.meta.dirname, "..")
const vaultRoot = path.resolve(
  process.env.OBSIDIAN_VAULT ?? "/Users/gardnervickers/Documents/General",
)
const blogRoot = path.join(vaultRoot, "Blog")
const contentRoot = path.join(repoRoot, "content")
const stagingRoot = path.join(repoRoot, ".content-staging")
const assetExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".pdf", ".png", ".svg", ".webp"])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "templates") continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(fullPath)))
    else files.push(fullPath)
  }
  return files
}

function parseFrontmatter(markdown, file) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return {}
  try {
    return YAML.parse(match[1]) ?? {}
  } catch (error) {
    throw new Error(`Invalid frontmatter in ${file}: ${error.message}`)
  }
}

async function exists(file) {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}

function safeRelative(root, target) {
  const relative = path.relative(root, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to copy a file outside ${root}: ${target}`)
  }
  return relative
}

async function resolveAsset(notePath, target) {
  const decoded = decodeURIComponent(target).replace(/^<|>$/g, "")
  const candidates = [
    path.resolve(path.dirname(notePath), decoded),
    path.resolve(blogRoot, decoded),
    path.resolve(vaultRoot, decoded),
    path.resolve(vaultRoot, "attachments", decoded),
    path.resolve(vaultRoot, "Attachments", decoded),
  ]
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate
  }
  return null
}

async function copyAsset(notePath, rawTarget, copiedAssets) {
  if (/^(?:https?:|data:|mailto:)/i.test(rawTarget)) return rawTarget
  const source = await resolveAsset(notePath, rawTarget)
  if (!source) throw new Error(`Missing asset '${rawTarget}' referenced by ${notePath}`)

  const relativeWithinBlog = path.relative(blogRoot, source)
  const isWithinBlog = !relativeWithinBlog.startsWith("..") && !path.isAbsolute(relativeWithinBlog)
  const destinationRelative = isWithinBlog
    ? relativeWithinBlog
    : path.join("assets", path.basename(source))
  const destination = path.join(stagingRoot, destinationRelative)

  const existingSource = copiedAssets.get(destinationRelative)
  if (existingSource && existingSource !== source) {
    throw new Error(
      `Two assets would publish as '${destinationRelative}': ${existingSource} and ${source}`,
    )
  }
  copiedAssets.set(destinationRelative, source)
  await mkdir(path.dirname(destination), { recursive: true })
  await cp(source, destination)
  return destinationRelative.split(path.sep).join("/")
}

async function processNote(notePath, copiedAssets) {
  const source = await readFile(notePath, "utf8")
  const frontmatter = parseFrontmatter(source, notePath)
  if (frontmatter.publish !== true) return null

  let output = source
  const obsidianEmbeds = [...source.matchAll(/!\[\[([^\]|#]+)([^\]]*)\]\]/g)]
  for (const match of obsidianEmbeds) {
    const target = match[1].trim()
    if (!assetExtensions.has(path.extname(target).toLowerCase())) continue
    const publishedTarget = await copyAsset(notePath, target, copiedAssets)
    output = output.replace(match[0], `![[${publishedTarget}${match[2]}]]`)
  }

  const markdownImages = [...source.matchAll(/!\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g)]
  for (const match of markdownImages) {
    const target = match[2]
    if (/^(?:https?:|data:)/i.test(target)) continue
    const publishedTarget = await copyAsset(notePath, target, copiedAssets)
    output = output.replace(match[0], `![${match[1]}](${encodeURI(publishedTarget)}${match[3]})`)
  }

  const relative = safeRelative(blogRoot, notePath)
  const destination = path.join(stagingRoot, relative)
  await mkdir(path.dirname(destination), { recursive: true })
  await writeFile(destination, output)
  return {
    relative,
    title: String(frontmatter.title ?? path.basename(relative, ".md")),
  }
}

async function main() {
  if (!(await exists(path.join(blogRoot, "index.md")))) {
    throw new Error(`Expected a blog home page at ${path.join(blogRoot, "index.md")}`)
  }

  await rm(stagingRoot, { recursive: true, force: true })
  await mkdir(stagingRoot, { recursive: true })

  const files = await walk(blogRoot)
  const copiedAssets = new Map()
  const published = []
  for (const file of files.filter((file) => file.endsWith(".md")).sort()) {
    const result = await processNote(file, copiedAssets)
    if (result) published.push(result)
  }

  if (published.length === 0) {
    throw new Error("No notes with 'publish: true' were found; existing content was preserved")
  }

  const posts = published.filter(({ relative }) => relative !== "index.md")
  const homePath = path.join(stagingRoot, "index.md")
  const home = await readFile(homePath, "utf8")
  const postList =
    posts.length === 0
      ? "_Posts are coming soon._"
      : posts
          .map(({ relative, title }) => {
            const href = encodeURI(relative.replace(/\.md$/, ""))
            return `- [${title}](${href})`
          })
          .join("\n")
  await writeFile(homePath, `${home.trimEnd()}\n\n## Posts\n\n${postList}\n`)

  await rm(contentRoot, { recursive: true, force: true })
  await rename(stagingRoot, contentRoot)
  console.log(
    `Synced ${published.length} public note(s) and ${copiedAssets.size} linked asset(s) from ${blogRoot}`,
  )
  for (const { relative } of published) console.log(`  - ${relative}`)
}

await main()
