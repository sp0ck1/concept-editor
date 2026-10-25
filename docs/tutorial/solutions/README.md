# Exercise solutions

These files contain worked implementations for the exercises in the [codebase guide](../README.md). They explain the additions and their behavior separately from the main reference chapters.

| Chapter                        | Solution                                                  |
| ------------------------------ | --------------------------------------------------------- |
| 1. Application architecture    | [Instance-loading trace](01-architecture.md)              |
| 2. Concepts and instances      | [Occurrence count](02-concepts-and-instances.md)          |
| 3. Relationships               | [Selected relationship count](03-relationships.md)        |
| 4. Editor and context          | [Sidebar visibility command](04-editor-and-context.md)    |
| 5. Loading and derived cards   | [Canvas summary](05-loading-and-derived-cards.md)         |
| 6. Cards                       | [Identity labels](06-cards.md)                            |
| 7. Canvas                      | [Reset View](07-canvas.md)                                |
| 8. Trees and containment       | [Immediate child counts](08-trees-and-containment.md)     |
| 9. Navigation and cameras      | [Canvas depth](09-navigation-and-cameras.md)              |
| 10. Creation and title editing | [New Card button](10-creation-and-title-editing.md)       |
| 11. Properties and tags        | [Metadata summary](11-properties-and-tags.md)             |
| 12. HTTP and persistence       | [Temporary reviewed property](12-http-and-persistence.md) |
| 13. Integration                | [Shared spatial creation command](13-integration.md)      |

Each implementation is optional. Most can be applied independently and can coexist with retained exercises. Chapter 13 explicitly starts with chapter 10's implementation and revises it.

Additions shown here are not evidence that the application already includes these features. Preserve unrelated code and use the [data-safety guidance](../README.md#data-safety) before running browser mutation checks. Source cleanup and data rollback are separate operations.
