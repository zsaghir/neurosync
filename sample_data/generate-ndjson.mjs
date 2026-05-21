import {readFileSync, writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const load = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'))
const docs = [...load('aiGeneratedCategory.json'), ...load('journalEntry.json'), ...load('task.json')]
writeFileSync(join(dir, 'sanity-import.ndjson'), docs.map((d) => JSON.stringify(d)).join('\n') + '\n')
