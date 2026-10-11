import { createContext } from 'svelte';
import type { Editor } from '$lib/components/editor/Editor.svelte';

export const [getEditorContext, setEditorContext] = createContext<Editor>();
