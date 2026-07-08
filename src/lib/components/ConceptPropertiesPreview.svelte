<script lang="ts">
  let {
    properties = {},
    onChange
  } = $props<{
    properties?: Record<string, string>;
    onChange: (properties: Record<string, string>) => void;
  }>();

  let entries = $derived(Object.entries(properties));

  let pendingFocusKeyInput = $state<string | null>(null);
  let pendingFocusValueInput = $state<string | null>(null);
  let keyUpdateHandledByKeyboard = $state(false);


  const keyInputs = new Map<string, HTMLInputElement>();
  const valueInputs = new Map<string, HTMLInputElement>();
  

  $effect(() => {
    if (pendingFocusKeyInput) {
      const input = keyInputs.get(pendingFocusKeyInput);

      if (input) {
        input.focus();
        input.select();
        pendingFocusKeyInput = null;
      }
    }

    if (pendingFocusValueInput) {
      const input = valueInputs.get(pendingFocusValueInput);

      if (input) {
        input.focus();
        input.select();
        pendingFocusValueInput = null;
      }
    }
  });

  function trackKeyInput(node: HTMLInputElement, key: string) {
    keyInputs.set(key, node);

    return {
      destroy() {
        keyInputs.delete(key);
      }
    };
  }

  function trackValueInput(node: HTMLInputElement, key: string) {
    valueInputs.set(key, node);

    return {
      destroy() {
        valueInputs.delete(key);
      }
    };
  }

  function getUniquePropertyKey(candidate: string, oldKey?: string) {
    const baseKey = candidate.trim();

    if (!baseKey) {
      return oldKey ?? 'property';
    }

    if (!(baseKey in properties) || baseKey === oldKey) {
      return baseKey;
    }

    let counter = 2;
    let key = `${baseKey}${counter}`;

    while (key in properties && key !== oldKey) {
      counter += 1;
      key = `${baseKey}${counter}`;
    }

    return key;
  }

  function updatePropertyKey(oldKey: string, newKey: string) {
    const trimmedKey = newKey.trim();

    if (!trimmedKey) {
      return oldKey;
    }

    const uniqueKey = getUniquePropertyKey(trimmedKey, oldKey);

    if (uniqueKey === oldKey) {
      return oldKey;
    }

    const nextProperties: Record<string, string> = {};

    for (const [key, value] of Object.entries(properties)) {
      if (key === oldKey) {
        nextProperties[uniqueKey] = value;
      } else {
        nextProperties[key] = value;
      }
    }

    onChange(nextProperties);

    return uniqueKey;
  }

  function updatePropertyValue(key: string, value: string) {
    onChange({
      ...properties,
      [key]: value
    });
  }

function handleKeyInputKeydown(
  event: KeyboardEvent,
  oldKey: string
) {
  const input = event.currentTarget as HTMLInputElement;

  if (event.key !== 'Enter' && event.key !== 'Tab') {
    return;
  }

  if (event.shiftKey) {
    return;
  }

  event.preventDefault();

  keyUpdateHandledByKeyboard = true;

  const nextKey = updatePropertyKey(oldKey, input.value);

  pendingFocusValueInput = nextKey;
}

function handleKeyInputBlur(event: FocusEvent, oldKey: string) {
  if (keyUpdateHandledByKeyboard) {
    keyUpdateHandledByKeyboard = false;
    return;
  }

  const input = event.currentTarget as HTMLInputElement;

  updatePropertyKey(oldKey, input.value);
}

  function handleValueInputKeydown(event: KeyboardEvent, key: string) {
    const input = event.currentTarget as HTMLInputElement;

    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    updatePropertyValue(key, input.value);
    input.blur();
  }

  function handleValueInputBlur(event: FocusEvent, key: string) {
    const input = event.currentTarget as HTMLInputElement;

    updatePropertyValue(key, input.value);
  }

  function getNextPropertyKey() {
    const baseKey = 'property';
    let key = baseKey;
    let counter = 1;

    while (key in properties) {
      counter += 1;
      key = `${baseKey}${counter}`;
    }

    return key;
  }

  function addProperty() {
    const key = getNextPropertyKey();

    pendingFocusKeyInput = key;

    onChange({
      ...properties,
      [key]: 'value'
    });
  }
</script>

<div class="concept-properties-preview">
  {#if entries.length === 0}
    <button
      class="concept-properties-empty"
      type="button"
      onclick={addProperty}
    >
      + property
    </button>
  {:else}
    {#each entries as [key, value] (key)}
      <div class="concept-property-row">
        <input
          use:trackKeyInput={key}
          class="concept-property-key"
          value={key}
          aria-label="Property name"
          onkeydown={(event) => handleKeyInputKeydown(event, key)}
          onblur={(event) => handleKeyInputBlur(event, key)}
        />

        <input
          use:trackValueInput={key}
          class="concept-property-value"
          value={value}
          aria-label="Property value"
          onkeydown={(event) => handleValueInputKeydown(event, key)}
          onblur={(event) => handleValueInputBlur(event, key)}
        />
      </div>
    {/each}

    <button
      class="concept-property-add"
      type="button"
      onclick={addProperty}
    >
      +
    </button>
  {/if}
</div>