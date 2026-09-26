---
name: dont-use-effect
description: Use for writing, refactoring, or reviewing React components and hooks involving derived state, event handling, fetching, subscriptions, or useEffect.
---

# Don't use Effect

Default to solving the task without `useEffect`. Effects synchronize React with external systems; they do not orchestrate React data flow. Apply this guidance within the requested scope. Explicit user instructions take precedence.

## Choose the owner

Check the project's dependencies and existing integrations first. Use the adopted state-management tools; this skill does not require adding a library.

Before adding or retaining an Effect, identify why the work runs and choose the appropriate owner:

- **Derived values:** Calculate from props, state, or query results during render. Remove redundant state. Use `useMemo` only for expensive pure calculations when measurement justifies it.
- **User interactions:** Put submissions, mutations, navigation, and notifications in event handlers. Extract shared handler logic into a function. Compute related next-state updates together rather than chaining Effects; state setters do not change the current render’s snapshot.
- **Server state:** Use the project's existing server-state integration for fetching and synchronization. Trigger mutations from the initiating event and handle completion through the integration's returned promise or callbacks. Keep query results in their existing owner unless they intentionally become an independently editable draft.
  - With native Convex React hooks, use `useQuery` from `convex/react`. Pass changing inputs as query arguments and use `"skip"` until prerequisites are available. Let Convex subscriptions update results rather than adding manual invalidation or mirroring results into client state.
  - When TanStack Query is already used, include changing request inputs in the query key and express dependent queries through `enabled`.
- **Client state:** Keep local state local with React state; lift shared state to the appropriate common owner. When the project already uses Jotai, use derived atoms for calculations and write atoms for coordinated transitions. Avoid duplicate state that requires synchronization Effects.
- **Parent communication:** Call parent callbacks in the originating event, or make the child controlled. Fetch shared data at the appropriate common owner and pass it down.
- **Identity changes:** Reset the intended subtree with a stable identity `key`. Prefer storing a selected ID and deriving the selected item. Preserve intended reset semantics: an ID-based selection and a full reset behave differently.
- **Partial state adjustment:** Prefer derivation or an explicit transition. Only if necessary, adjust the same component’s state during render with a change guard that prevents loops. Keep all other side effects out of render.
- **External stores:** Prefer the library’s React integration or `useSyncExternalStore`.
- **App initialization:** Use the appropriate application entry point with server/client boundaries respected. An empty dependency array does not guarantee once-per-app execution.

## When an Effect remains necessary

For each remaining Effect:
- Identify the external system and why rendering requires synchronization.
- Include all reactive dependencies and clean up resources when applicable.
- Make setup and cleanup tolerate remounting. Prevent stale asynchronous results from committing.

Do not evade this guidance with `useLayoutEffect`, side effects in `useMemo` or render, run-once refs, or a custom hook that merely hides unnecessary synchronization.

Finish by checking that each value has one owner and each action runs from its actual cause. Briefly explain any necessary Effect.
