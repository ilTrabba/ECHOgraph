Graph visualization with D3 - ECHOgraph for character's POV

Description:
-------------
This project offers a clear and effective way to visualize information related to the POVs of characters from literary works, films, and much more. 
The visualization is divided between the presentation of an interactive chord diagram, which users can dynamically explore, and an interactive graph with nodes and edges based on JSON data. Users can select a node as a "point of view" (POV) with a single click, view tooltips with opinions on the connected links, and filter dialoguesby season using a slider filter.

Principles features:
---------------------------
- Chord diagram to show a general and global view of the relative context
- Interactive graph with draggable nodes.
- Edges with colored arrows indicating sentiment (positive, negative, ambiguous).
- Tooltip showing opinion labels when hovering over a node connected to the selected POV.
- Aesthetic season filter with dots on a line to select the season.
- Ability to reset selection by clicking again on the node or edge.
- Fixed color legend in the top-left corner.
- Modern style with animations and subtle shadows for tooltips and the dialogue box.

How to use:
-----------
1. Open index_chord.html in a modern browser (Chrome, Firefox, Edge).
2. Select a specific character name (in black) with a single click to enter the POV and explore the labels.
3. Switch to the graph visualization to explore the node with a more clear view over a connected node to view the tooltip with opinions.
4. Select a season using the slider filter (line with dots).
5. Click on an edge between two nodes within the POV to display that season’s dialogues in the dialogue box.
6. Click again on a node or edge to reset the selection and hide the dialogue box.
7. Use the legend in the top-left corner to understand the meaning of the edge colors.

Personalizations:
------------------
- Change the graph’s colors or link distances by modifying colorMap and forceLink distance.
- Adjust the size and style of the season filter in the CSS.
- Add more seasons or dialogues in the data.json file following the existing structure.
- Enhance the dialogue box by adding animations or character-specific avatars.

Support:
---------
For questions or issues, contact the developer or open an issue on the GitHub repository.

---

Thanks!