# Updates Ideas

Recovered from the historical `concepts.json` and `concept_instances.json` files.
Now used as the authoritative product roadmap, working backlog, and brainstorming document.
The Current Priorities below are the owner's immediate order of work and take precedence over the broader High, Medium, and Low backlog categories.
Move ideas between sections when implementation is verified or the owner changes their status or priority.
Rejected material is stored separately in `rejected_ideas.csv` and is not duplicated here.

Record concrete product decisions and ideas from planning discussions here. Planned work is not authorization to implement it, and discussing a feature does not mark it implemented. Preserve owner-assigned priorities; leave new work unranked unless a priority is specified.

Metadata is shown only when present. No Concept in this recovered subtree had property values;
therefore, an omitted metadata line means both properties and tags were empty unless tags are listed.

Original Updates tags: geronimo, action packaed

## Current Priorities

These are the owner's top two priorities, in order. This records direction, not an instruction to implement both at once.

The Electron window-launch milestone is complete for the owner's current purposes; see [Done](#electron-window-launch). Automatic server startup/shutdown and distributable packaging are not included in that completed milestone.

### 1. Complete the data model for saving, loading, and root contexts

- Define root/context semantics so multiple contexts can be open in the Editor and each has a meaningful designated root, not merely whichever node is currently being viewed.
- Contexts should have Concept identity and support root-level title, properties, tags, and dates through their Concept representation. How their root occurrences and boundaries are recorded still needs definition.
- Concepts remain shared by identity across loaded contexts, not private copies owned by each context. Different IDs describing the same thing require user-directed merging, not automatic identity matching by title or metadata.
- Establish project/session saving and loading for multiple roots, with individual contexts exportable as portable `.context` documents. The extension, archive format, embedded-versus-referenced storage details, and import/conflict rules remain to be finalized.
- Higher-priority export needs include exporting an individual card's data to CSV or a table representation. Multi-sheet Excel or zipped multi-table exports are exploratory, not a chosen format.
- Preserve existing data while planning this work. No persisted schema or storage migration is authorized merely by documenting these priorities.

### 2. Redesign the card

- After the data-model work, redesign the card before proceeding to further feature work.
- Review the existing card-layout ideas with the owner; the redesign is not yet specified or implemented.

## High Priority Updates

- Tags should be draggable to other tag areas and to the canvas.
- Ctrl F to search, find concepts

- Optional card detail: allow showing/hiding the properties and work area when a card is large enough, rather than forcing expanded detail. This is separate from draggable tags.

### Interactive ConceptCard Previews

- Hover a ConceptInstance in a tree or another view to preview its ConceptCard
- Preview can show the child tree and notes when available
- Preview should eventually be interactive
- Exact placement, delay, size, and interaction behavior can be decided later

### Notes on Concepts

- One Component for Card Layer
- One Component for full size Canvas layer
- Considerations
  - Tags: maybe
  - Should the Full Sized one be Resizeable?
  - Should the Full Sized one just be the concept Scaled to full size? Duhhhhh

- On entering a canvas with genuinely no remembered camera, frame its content; otherwise restore the remembered view.
  - Clarification under discussion: a valid origin camera is not a missing camera. Current camera fields have numeric defaults, so there is not yet a reliable absent-camera marker. No schema/default change is approved by this clarification.
- Overlay that says "Tagging ${card.concept.title}""
- Title Size Scales Up as Card Scales Up

### Title Conflicts

- When a title matches existing Concepts, ask whether to create a new Concept or use an existing one
- Show enough context to choose among same-title Concepts

- Typeahead Search

## Medium Priority Updates

### Card Size Controls Visible Detail

- Tags: medium-high

- Toggle expanded/collapsed card detail
- Remember the selected card view mode
- Transitions should feel smooth

- Stack / Cascade Button
  - Stack cards on top of each other or cascade them like Solitaire
  - Tags: medium-low
- Arrange Selected Items
  - Tags: medium
- Right Mouse Should Pan Even When Over Card
  - Tags: medium-high
- Zoom Slider to allow more granularity
  - Tags: medium-low
- Indicator: Concept Drop Area Hover
  - Tags: medium-high
- Arrange Grid math must be addressed
- Start at most recent concept-id
- Right-Click "Move to..."

### Make resizeHandle larger

- Scale with zoom to max-width and max-height?

- Scale text and/or elements with zoom
- Overlay that says "Dropping Onto ${card.concept.title}"

- Title Input Scales Up As Card Scales Up

### Importance and Soft Grouping

- Visually emphasize particular ConceptInstances within a canvas
- Use header colors or similar instance-level styling
- Make purple cards feel grouped apart from green cards without changing containment
- Important cards might stay fixed while other cards are arranged
- Exact storage and controls can be decided later
- Adjustable Font Size
  - Tags: likely, good idea

### Send Card to Parent Concept (Up One Level)

- Should Also be Doable by Dragging to Tree

### Tagging Needs to be Easier

- Press T -> T -> T to Start Tagging on the isActive Card if only one in Selection

- Open Selected to Full Size
- Cards Marked Important Might Not Be Arranged when others are
- Arrange Items Alphabetically

### Placement when filing instances into another card

- Planned behavior; Medium priority, implementation not requested.
- Dropping a ConceptInstance into another card should assign coordinates in the destination's canvas, not retain coordinates from its previous context.
- Apply the same placement rule to canvas cards, groups of selected cards, and dragged child-tree nodes.
- Choose a destination group-center point within a radius of approximately 100 pixels of `(0, 0)`, then translate the entire group so its center lands there.
- Preserve the cards' relative x/y offsets by applying the same translation to every member. An offset of `(3, 8)` between two cards should remain `(3, 8)` after placement.
- The radius constrains the group's center, not each member; a large or widely spaced group can extend beyond it. Treat a single card as a group of one.
- Dropping a tree child onto the open canvas background should still place it at the pointer's world-coordinate drop position. Near-origin group placement applies to filing into another card, not ordinary dragging within the current canvas.

## Low Priority Updates

- Add a button on the tree topbar to show the current canvas as the tree root, useful for large categories. This is a low-priority control, separate from opening a tree node by double-click.

- Add snap-to points at the sizes of the small, medium, and large. increase the size of the large and possibly the medium

- hold some key down and drag while only one card is selected to assign its tag to many cards
- Line draws from center of dragStart to current mouse pos
- Snap to Canvas Rect bounds - sidebar, topbar, bottom, right
- Try different UI for child-tiles and tags
- Fix Mouse Pointer pos vs. Zoom
- Jittery drag due to 450ms?
- Arrangement that places similar-widths nearby

- Enlarge Cards to Fit

### Images and Spatial Media

- Images will probably be a special entity
- Images Pasted to Canvas
- Canvas Image Resizing
- Canvas Image Drag and Drop Into Child Area
- Images should remain spatial, draggable, and animated like cards
- View all images in category
- View Sample of Images (in large item category)

- Clickable Panner for those who are into it
  - Tags: Bottom right
- Concepts Spawn Small by Default

### Keep Card View State: Whether it was in Note View, or some other views later

- createed State for CArds

- Pasting a web link should automatically create a screenshot preview
- A simple view of all recently added concepts, including deleted, along with timestamps
  - Tags: very low
- add npx playwright install to install routine on new servers
- Notes Editor UI Differs between Small, Medium, Large
- Items in the Drop Area should transition to their new position on the Canvas on new canvas entry before transforming into their card size

- Investigate Playwright or another approach for automatic web screenshots
- Remember the last canvas the user was on
- Bottom edge and Right edge should be Resize Grabbers like Bottom Right Corner
- When you select a card and write "tag" with the single card selected, that should focus you on tags
- Text in Child Drop Area cuts off at bottom

## Priority Pending

- Add a button on cards indicating whether they are available to accept new members. Priority and exact behavior are not yet specified.

- Resize all selected cards as a selection-wide capability. The owner lowered this from High to **Medium or Low**; the exact tier remains to be chosen.

## Planned Relationships Work

Priority has not yet been assigned. These are future UI requirements, not implemented features or authorization to start work now. The existing relationship model and partial sidebar display remain separate from this work.

### Relationship representation and dates

- A Concept representing a relationship occurrence serves a purpose: it lets that relationship appear in the tree, on the canvas, and as a table row like other information. It is not merely an alias for the relationship-kind Concept.
- The relationship record describes its kind and participants. Dates belong to the representing Concept, not to the relationship record's properties.
- This records the intended purpose of Concept representation; it does not change the current optional `representedByConceptId` field or decide when representations must be created automatically.

### Canvas relationship visualization

- Add a preferably **square** toggle button to show or hide relationships on the canvas.
- Connect the two participating cards with a line and a rectangular label box with a **black border and yellow background**.
- The label should state how the participants are related. Resolve definition placeholders such as `[0]` and `[1]` to participant names so the full statement is understandable even when the cards are far apart.
- Clicking the label should bring the two participating card instances into the vicinity of the label. This would move their placements, not rename Concepts or merge their identities; exact placement and animation remain unspecified.
- Defer mounting the visualization until it is first enabled, unless it is already enabled when the view loads. Once mounted, retain its DOM while hidden rather than rebuilding it on each toggle. How the enabled state is remembered remains to be decided.
- Multiple occurrences of a Concept, relationships with more than two participants, relationship-type participants, and connector/label placement still need design decisions. Do not assume every stored relationship is a simple pair of cards.

### Defining relationships from cards

- A card context menu should offer **Define relationship**.
- Choosing it begins target selection: a temporary line runs from the first card's center to the pointer.
- Hovering another card highlights it using the existing marquee color.
- Clicking the target opens a **Define Relationship** modal for the selected pair.
- The modal's conditional fields, relationship-kind selection, definition authoring, validation, and cancellation behavior are not designed yet.
- This is not currently an in-app authoring workflow. Relationship definitions currently have a read path (`getAllRelationshipDefinitions` in `src/lib/server/repositories/relationshipDefinitionRepository.ts`), not a complete definition-editing UI or write workflow.

## In Progress

### Card title editing through Concept reassignment

- Editing one occurrence can change its Concept reference without renaming the old shared Concept
- Duplicate-title confirmation and same-title selection still need a complete UI

## Done

### Electron window launch

- The existing SvelteKit application can be opened in an Electron window. The owner considers this launch milestone complete and is moving on to data-model work.
- The launcher selects native Windows Electron on Windows and the local Linux Electron installation in WSL. The initial window size is 1280 × 720.
- The Vite/SvelteKit server is still started separately with `npm run dev`; `npm run start` launches Electron. Closing Electron does not stop that separately started server.
- Automatic server startup/shutdown, installers, distribution, and production packaging remain separate unfinished work. Completion here does not claim a packaged one-action launch.

### Tree-node double-click navigation

- Double-clicking a node inside a card's `ConceptDropArea` opens that specific ConceptInstance's canvas and shows its children.
- Restored by the owner and reported working. No independent agent retest was performed for this roadmap update.

### Relationships Framework - Done for Now

- Relationship model, repository, API routes, inverse definitions, and partial sidebar display exist
- Current relationship work is sufficient for this phase
- Further visualization and authoring requirements are recorded under [Planned Relationships Work](#planned-relationships-work); that UI is not included in this completed framework work

---

- Save Camera Position of ConceptInstances
- Concept IDs are separate from titles
- Different Concepts can have the same title
- Case-insensitive title matching
- ConceptCard child areas display recursive trees of ConceptInstances
- Cards can be dragged into child areas to change their parent instance

- Frame or focus selected cards

### Items paste in as small concepts at their width

## User UI Customizations - Long Term Updates

- Tags: Optional

- Images for Left Sidebar
  - Tags: Optional
- Images for concept-drop-area
  - Tags: Optional
- Customize canvas color
- Customize concept drop area color
- Customize card color by size
- Tiling background for canvas
  - Tags: Optional
- Customize card background by size
- Saveable themes per context
- Active theme per context, choose from any theme

## Long-Term (Any Priority)

### View Orphaned Concepts

- Tags: very low

- Don't Load Unless Asked For

- The [Electron window-launch milestone](#electron-window-launch) is complete for the current phase. Automatic server management and production packaging remain unfinished; storage and sync decisions remain open.
- Lock Concept Size

### Timeline

- Tags: Sure Thing
- Planned long-term workspace view; no implementation requested or new priority assigned. It may be a secondary view within the Contexts application, alongside the organization-focused context editor, rather than only a component inside its canvas. Drawing and planning views are further possibilities, not selected implementations.
- Use the same underlying Concepts across views. Dated Concepts can appear on the timeline; Concepts with no dates remain available elsewhere but do not appear on it. This also applies to Concepts representing relationship occurrences.
- Provide a scope toggle between the active context and the whole loaded project. **Default to the active context.**
- A horizontal ruler with year markings, viewed through a resizable outer container that acts as a mask over a longer year strip.
- Resize the container's left/right edges to reveal more or fewer years. Year spacing stays fixed: changing the width changes the visible range, not the scale or zoom.
- Grab and drag the middle area horizontally to slide the year strip beneath the mask, moving the visible range earlier or later. This interaction changes only the horizontal offset.
- Clip the years outside the visible container. Absolute positioning is a possible implementation detail, not a settled requirement.
- How Concepts/instances connect to the ruler and how dates are positioned on it remain unspecified. Date ownership and entry behavior are described below; exact persisted field names and structure are not yet defined.

### Dates on Concepts

- Dates belong to Concepts, including Concepts representing relationship occurrences, not to individual placements.
- Provide an Add new date action. Start with one date entry, but allow deleting it so a Concept can have zero dates.
- The owner specifies an empty string (`""`) in JSON for the no-date case. The representation of multiple dates, date labels, and exact field structure still need definition; no model migration or implementation is requested.

### Export category as list

- options to arrange child items in different ways
- ordered
- unordered
- all children or current concept only?

## Sorting Algorithm for Arranging

- All cards are sorted by size (width x height)
- Then in the list, each 2 cards are rated for their likelihood of being horizontally placed by taking their sum and seeing if any one card is still less wide than it

## Ability to Sequence Properties by Draegging and Dropping them

- have a handle for drag and drop - no other area

## UI

- Sidebar Titles Should Fit in their Constraints font-size
- Table in the top pane and Canvas in the bottom pane with an adjustable divider
  - Move divider all the way up for Canvas only
  - Move divider all the way down for Table only
  - Leave divider in the middle to see the same Concepts both ways

### Card Layout

- Mini sidebar on left, scales with width and height
- adjustable middle bar
- tree on the right
- notes come from top

## Imports

### Requirements

- Must have id, name, optinally has tags column, and all other columns are treated as property values corresponding to the header

## Other ungrouped ideas

- A way to make names bigger when concept is bigger.
  - Tags: visual representation, medium-high
- Cards should move to the center with largest cards at the bottom before fanning out into their pattern
  - Tags: Optional, sometimes

### Temporary Brainstorm Workspace

- Volatile workspace that is probably saved until explicitly flushed
- Drag useful ideas into permanent contexts before flushing
- Flush everything left in the sandbox when finished
- Exact lifecycle can be decided later

- Maybe Tree can be Scrollable by holding a key or clicking a button or right clicking in the area
- Sequencing View where Dragging Cards Resequences

### Notes and Bullet Points

- Notes will probably use a textarea or Markdown
- Bullet points are note content, not automatically Concepts
