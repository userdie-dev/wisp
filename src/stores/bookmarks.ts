import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { openPersistedStore, type PersistedStore } from '@/lib/persisted-store'

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string | null
  folderId: string | null
  createdAt: number
}

export interface BookmarkFolder {
  id: string
  name: string
  parentId: string | null
}

let storePromise: Promise<PersistedStore> | null = null
function bookmarksStore(): Promise<PersistedStore> {
  return (storePromise ??= openPersistedStore('bookmarks.json'))
}

export const useBookmarksStore = defineStore('bookmarks', () => {
  const bookmarks = ref<Bookmark[]>([])
  const folders = ref<BookmarkFolder[]>([])
  const ready = ref(false)

  async function load() {
    const store = await bookmarksStore()
    bookmarks.value = (await store.get<Bookmark[]>('bookmarks')) ?? []
    folders.value = (await store.get<BookmarkFolder[]>('folders')) ?? []
    ready.value = true
  }
  load()

  async function persist() {
    if (!ready.value) return
    const store = await bookmarksStore()
    await store.set('bookmarks', bookmarks.value)
    await store.set('folders', folders.value)
  }

  const isBookmarked = computed(() => (url: string) => bookmarks.value.some((b) => b.url === url))

  function add(bookmark: Omit<Bookmark, 'id' | 'createdAt'>) {
    bookmarks.value.push({ ...bookmark, id: nanoid(), createdAt: Date.now() })
    persist()
  }

  function removeByUrl(url: string) {
    bookmarks.value = bookmarks.value.filter((b) => b.url !== url)
    persist()
  }

  function remove(id: string) {
    bookmarks.value = bookmarks.value.filter((b) => b.id !== id)
    persist()
  }

  function addFolder(name: string, parentId: string | null = null) {
    const folder: BookmarkFolder = { id: nanoid(), name, parentId }
    folders.value.push(folder)
    persist()
    return folder.id
  }

  return { bookmarks, folders, isBookmarked, add, removeByUrl, remove, addFolder }
})
