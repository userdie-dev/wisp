<script setup lang="ts">
import { ref, computed } from 'vue'
import { FolderPlus, MoreVertical, Trash2, ExternalLink } from '@lucide/vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import { useBookmarksStore } from '@/stores/bookmarks'
import { useTabsStore } from '@/stores/tabs'

const bookmarks = useBookmarksStore()
const tabs = useTabsStore()

const rootBookmarks = computed(() => bookmarks.bookmarks.filter((b) => b.folderId === null))
const expandedFolders = ref(new Set<string>())

function toggleFolder(id: string) {
  expandedFolders.value.has(id) ? expandedFolders.value.delete(id) : expandedFolders.value.add(id)
}

function bookmarksInFolder(folderId: string) {
  return bookmarks.bookmarks.filter((b) => b.folderId === folderId)
}

function open(url: string) {
  tabs.createTab(url)
}

function newFolder() {
  const name = prompt('Название папки')
  if (name) bookmarks.addFolder(name)
}
</script>

<template>
  <div class="mx-auto h-full max-w-2xl overflow-y-auto px-6 py-8">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-lg font-semibold">Закладки</h1>
      <button
        class="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-fg/10"
        @click="newFolder"
      >
        <FolderPlus :size="14" /> Новая папка
      </button>
    </div>

    <div v-if="bookmarks.folders.length === 0 && rootBookmarks.length === 0" class="text-sm text-fg-muted">
      Закладок пока нет.
    </div>

    <div v-for="folder in bookmarks.folders" :key="folder.id" class="mb-2">
      <button
        class="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-fg/5"
        @click="toggleFolder(folder.id)"
      >
        {{ folder.name }}
      </button>
      <div v-if="expandedFolders.has(folder.id)" class="ml-4 space-y-0.5">
        <div
          v-for="bookmark in bookmarksInFolder(folder.id)"
          :key="bookmark.id"
          class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fg/5"
        >
          <button class="min-w-0 flex-1 truncate text-left text-sm" @click="open(bookmark.url)">
            {{ bookmark.title || bookmark.url }}
          </button>
          <DropdownMenuRoot>
            <DropdownMenuTrigger class="hidden rounded p-1 hover:bg-fg/10 group-hover:block">
              <MoreVertical :size="14" />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                class="min-w-40 rounded-md border border-border bg-surface p-1 shadow-lg"
                :side-offset="4"
              >
                <DropdownMenuItem
                  class="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-fg/10"
                  @select="open(bookmark.url)"
                >
                  <ExternalLink :size="14" /> Открыть в новой вкладке
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="flex cursor-default items-center gap-2 rounded px-2 py-1.5 text-sm text-red-500 outline-none hover:bg-fg/10"
                  @select="bookmarks.remove(bookmark.id)"
                >
                  <Trash2 :size="14" /> Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </div>
      </div>
    </div>

    <div class="space-y-0.5">
      <div
        v-for="bookmark in rootBookmarks"
        :key="bookmark.id"
        class="group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fg/5"
      >
        <button class="min-w-0 flex-1 truncate text-left text-sm" @click="open(bookmark.url)">
          {{ bookmark.title || bookmark.url }}
        </button>
        <button
          class="hidden rounded p-1 hover:bg-fg/10 group-hover:block"
          aria-label="Удалить закладку"
          @click="bookmarks.remove(bookmark.id)"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
