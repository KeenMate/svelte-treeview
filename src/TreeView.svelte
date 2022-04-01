<script>
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher();

	//#region helpers
	/* Tree view helpers */

	//#region basic helpres

	function getParentNodePath(nodePath) {
		return nodePath.substring(0, nodePath.lastIndexOf("."));
	}

	function hasChildren(tree, nodePath) {
		return tree.find((x) => getParentNodePath(x.nodePath) === nodePath);
	}

	function nodePathIsChild(nodePath) {
		return !nodePath || !!(nodePath.match(/\./g) || []).length;
	}

	function getParentChildrenTree(tree, parentId, isChild, getParentId) {
		return (tree || []).filter((x) =>
			!parentId ? !isChild(x) : getParentId(x) === parentId
		);
	}

	export function allCHildren(tree, parentId, isChild) {
		let children;
		children = tree.filter((x) => {
			if (!parentId) {
				//top level
				return !isChild(x);
			} else {
				return (
					x.nodePath.startsWith(parentId.toString()) && x.nodePath != parentId
				);
			}
		});
		return children;
	}

	export function getAllLeafNodes(tree) {
		return tree.filter((x) => {
			return x.hasChildren == undefined || x.hasChildren == false;
		});
	}

	function joinTrees(filteredTree, tree) {
		return tree.map(
			(tnode) =>
				filteredTree.find((fnode) => tnode.nodePath === fnode.nodePath) || tnode
		);
	}

	function changeExpansion(tree, nodePath, expandedProperty) {
		return tree.map((x) => {
			let t = x;
			if (x.nodePath == nodePath) {
				t[expandedProperty] = !x[expandedProperty];
			}
			return t;
		});
	}

	function OrderByPriority(tree, priorityProp) {
		tree.sort((a, b) => {
			if (b[priorityProp] > a[priorityProp]) return -1;
			return 1;
		});
		return tree;
	}

	//#endregion

	//#region selection

	function ChangeSelection(
		recursiveely,
		tree,
		nodePath,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		if (!recursiveely) {
			//non recursiveely

			return addOrRemoveSelection(tree, nodePath, selectedProperty);
		} else {
			//recursiveely

			//only allow selection if it doesnt have any children
			tree = addOrRemoveSelection(tree, nodePath, selectedProperty);
			return recomputeAllParentVisualState(
				tree,
				nodePath,
				isChild,
				selectedProperty,
				getParentId,
				filteredTree
			);
		}
	}

	function addOrRemoveSelection(tree, nodePath, selectedProperty) {
		return tree.map((x) => {
			let t = x;
			if (x.nodePath == nodePath) {
				t[selectedProperty] = !x[selectedProperty];
				t.__visual_state = !x[selectedProperty];
			}
			return t;
		});
	}

	function ChangeSelectForAllChildren(
		tree,
		parentId,
		isChild,
		selectedProperty,
		changeTo,
		getParentId,
		filteredTree
	) {
		tree = tree.map((x) => {
			//changes itself
			if (parentId == x.nodePath) {
				x = changeSelectedIfNParent(x, selectedProperty, changeTo);
			}

			if (!parentId) {
				//top level
				if (!isChild(x)) {
					x = changeSelectedIfNParent(x, selectedProperty, changeTo);
				}
			} else {
				//if parentId isnt root
				if (
					x.nodePath.startsWith(parentId.toString()) &&
					x.nodePath != parentId.toString()
				) {
					x = changeSelectedIfNParent(x, selectedProperty, changeTo);
				}
			}
			return x;
		});
		tree = recomputeAllParentVisualState(
			tree,
			parentId,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
		return tree;
	}

	//changes selectedproperty or visual state depending on
	function changeSelectedIfNParent(node, selectedProperty, changeTo) {
		if (!node.hasChildren) {
			node[selectedProperty] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	function getVisualState(
		filteredTree,
		node,
		isChild,
		selectedProperty,
		getParentId
	) {
		let children = getParentChildrenTree(
			filteredTree,
			node.nodePath,
			isChild,
			getParentId
		);

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return x[selectedProperty] === true || x.__visual_state === "true";
			})
		) {
			return "true";
		}
		//not every child but at least one return indeterminate
		else if (
			children.some((x) => {
				return (
					x[selectedProperty] === true ||
					x.__visual_state === "indeterminate" ||
					x.__visual_state === "true"
				);
			})
		) {
			return "indeterminate";
		} else {
			return "false";
		}
	}

	//changes status of all parents of given nodepath until root
	function recomputeAllParentVisualState(
		tree,
		nodePath,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let parent = getParentId({ nodePath: nodePath });

		let newstate;
		filteredTree.forEach((x) => {
			if (x.nodePath == parent) {
				newstate = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
				);
				x.__visual_state = newstate;
				console.log("recomputing" + parent + " ->" + newstate);
			}
		});
		if (getParentNodePath(parent) != "") {
			tree = recomputeAllParentVisualState(
				tree,
				parent,
				isChild,
				selectedProperty,
				getParentId,
				filteredTree
			);
		}
		return tree;
	}

	//computes visual states for all nodes with children
	function computeInitialVisualStates(
		tree,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let rootELements = getParentChildrenTree(tree, null, isChild, getParentId);
		rootELements.forEach((x) => {
			if (x.hasChildren == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					selectedProperty,
					getParentId,
					filteredTree
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
				);
			}
		});
		return tree;
	}

	function computeChildrenVisualStates(
		tree,
		node,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let children = getParentChildrenTree(
			tree,
			node.nodePath,
			isChild,
			getParentId
		);
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x.hasChildren == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					selectedProperty,
					getParentId,
					filteredTree
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
				);
			}
		});
		return tree;
	}

	export function deleteSelected(tree) {
		return tree.map((t) => {
			let x = t;
			x.__selected = false;
			x.__visual_state = "false";
			return x;
		});
	}

	//#endregion

	//#region drag and drop

	/**
	 * moves node from one parent to another
	 * @param {Object[]} tree - tree
	 * @param {nodePath} movedNodePath - nodepath of moved(dragged) node
	 * @param {nodePath} targetNodePath - nodepath of node where it should be moved ( either bellow it in priority or as child)
	 * @param {function} isChild - funcion to get if child
	 * @param {boolean} nest - if true, it will insert moved node as child of target node, if false, it will insert it bellow it in priority
	 * @param {string} priorityProp - prop where priority is stored
	 */
	function moveNode(
		tree,
		movedNodePath,
		targetNodePath,
		isChild,
		nest,
		priorityProp
	) {
		// if you are not nesting, you want to be on same level
		let parentNodePath = !nest
			? getParentNodePath(targetNodePath)
			: targetNodePath;

		//trying to move parent to child
		if (parentNodePath.startsWith(movedNodePath)) return;

		//dont create new node if you only moved inside same parrent
		let insideParent =
			!nest &&
			getParentNodePath(movedNodePath) == getParentNodePath(targetNodePath);
		let newParrentNodePath = movedNodePath;
		if (!insideParent) {
			newParrentNodePath =
				(parentNodePath ? parentNodePath + "." : "") +
				getNextNodeId(tree, parentNodePath, isChild);
		}

		//* find target node
		let targetNode = tree.find((x) => x.nodePath == targetNodePath);
		let movedNode;

		console.log("parentNodePath: " + newParrentNodePath);

		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children
			if (node.nodePath == parentNodePath) {
				node.hasChildren = true;
				node[expandedProperty] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (!insideParent && node.nodePath.startsWith(movedNodePath)) {
				//replace old parent with new
				let newPath = node.nodePath.replace(movedNodePath, newParrentNodePath);
				console.log(node.nodePath + " -> " + newPath);
				node.nodePath = newPath;
			}

			//if it is moved node
			if (node.nodePath == newParrentNodePath) {
				movedNode = node;

				if (nest || targetNode[priorityProp] != null) {
					let newpriority = 0;
					if (!nest) {
						//calculate next
						newpriority = (targetNode[priorityProp] ?? 0) + 1;
					}

					console.log("new priority:" + newpriority);

					InsertPriority(
						tree,
						parentNodePath,
						newParrentNodePath,
						newpriority,
						priorityProp,
						isChild
					);

					node[priorityProp] = newpriority;
				} else {
					//so old priority doesnt mess up orderring
					movedNode[priorityProp] = undefined;
				}
			}
			return node;
		});

		//* insert node at right possition of array
		let oldIndex = tree.findIndex((x) => x.nodePath == newParrentNodePath);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex((x) => x.nodePath == targetNode.nodePath);
		tree.splice(index + 1, 0, movedNode);

		//hide plus icon if parrent of moved node doesnt have any more children
		let movedNodeParrent = tree.find(
			(x) => x.nodePath == getParentNodePath(movedNodePath)
		);
		if (
			movedNodeParrent &&
			!allCHildren(tree, movedNodeParrent.nodePath, isChild).length
		) {
			movedNodeParrent.hasChildren = false;
		}

		return tree;
	}

	//recomputes all priorities after inserted priority
	//also changes all priorities to be one apart (1,5,6 => 1,2,3)
	function InsertPriority(
		tree,
		parentNode,
		movedNodePath,
		insertedPriority,
		priorityProp,
		isChild
	) {
		let nextPriority = insertedPriority + 1;
		OrderByPriority(
			allCHildren(tree, parentNode, isChild),
			priorityProp
		).forEach((n) => {
			if (n[priorityProp] >= insertedPriority && n.nodePath != movedNodePath) {
				n[priorityProp] = nextPriority++;
			}
		});
	}

	//return biggest value of nodepath number that children are using +1
	function getNextNodeId(tree, parentPath, isChild) {
		let max = 0;
		//findes biggest nodeNumber for
		allCHildren(tree, parentPath, isChild).forEach((node) => {
			let parent = getParentNodePath(node.nodePath);
			if (parent == parentPath) {
				let num = node.nodePath.substring(parent ? parent.length + 1 : 0);
				if (parseInt(num) >= parseInt(max)) max = num;
			}
		});
		return parseInt(max) + 1;
	}

	//#endregion

	/* Tree view helpers end */

	//#endregion

	//! required
	export let tree = null; //array of nodes with nodePath
	export let treeId = null; //string
	export let maxExpandedDepth = 3; //number
	//tree that will be rendered(will be same as tree if null)
	export let filteredTree; //array of nodes with nodePath
	export let recursive = false; //bool
	export let checkboxes = false; //bool
	//if true, will show checkboxes to elements with children
	export let leafNodeCheckboxesOnly = false; //bool
	//true = disabel hide = false
	export let disableOrHide = false; //bool
	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false; //bool
	//properties
	export let expandedProperty = "__expanded";
	export let selectedProperty = "__selected";
	export let usecallbackPropery = "__useCallback";
	export let priorityPropery = "__priority";
	//classes for customization of tree
	export let treeCssClass = "", nodeCssClass = "", expandedToggleCss = "", collapsedToggleCss = ""
	//class shown on div when it should expand on drag and drop
	export let expandClass = "inserting-highlighted";
	//will nest of at least one of them is meet
	export let timeToNest = null;
	export let pixelNestTreshold = 150;
	export let expandCallback = null;




	export let getId = (x) => x.nodePath;
	export let getParentId = (x) => getParentNodePath(x.nodePath);
	export let isChild = (x) => nodePathIsChild(x.nodePath);


	//! DONT SET ONLY USED INTERNALLY

	//path of currently dragged node
	export let draggedPath = null;
	export let highlightedNode = null;
	export let childDepth = 0; //number
	export let parentId = null; //string

	let dragenterTimestamp;
	let canNestPos = false;
	let canNestTime = false;
	let canNest;
	let dragTimeout;
	let validTarget = false;
	$: canNest = canNestPos || canNestTime;

	const getNodeId = (node) => `${treeId}-${getId(node)}`;

	$: parentChildrenTree = OrderByPriority(
		getParentChildrenTree(
			filteredTree === undefined ? tree : filteredTree,
			parentId,
			isChild,
			getParentId
		),
		priorityPropery
	);
	$: ComputeVisualTree(filteredTree);
	$: parsedMaxExpandedDepth = Number(maxExpandedDepth ?? 0);

	function ComputeVisualTree(filteredTree) {
		tree = computeInitialVisualStates(
			tree,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
	}

	//#region expansions

	function expandNodes(nodes) {
		if (!nodes || !nodes.length) return;
		nodes.forEach((x) => toggleExpansion(x, true));
	}

	function toggleExpansion(node, setValueTo = null) {
		tree = changeExpansion(tree, node.nodePath, expandedProperty);

		let val = node[expandedProperty];

		//trigger callback if it is present and node has useCallbackPropery
		if (val && expandCallback != null && node[usecallbackPropery] == true) {
			console.log("calling callback");
			fetchNodeDataAsync(node)
				.then((val) => {
					tree = tree.concat(val);
					node[usecallbackPropery] = false;
				})
				.catch((reason) => {
					console.log("ERROR IN CALLBACK!!");
					console.log(reason);
				});
		}

		//expansion events
		dispatch("expansion", {
			path: node.nodePath,
			value: val,
		});

		if (val) {
			dispatch("expanded", node.nodePath);
		} else {
			dispatch("closed", node.nodePath);
		}
	}

	//awaits function provided in expandCallback
	async function fetchNodeDataAsync(node) {
		let data = await expandCallback(node);
		console.log("loaded new nodes: ");
		console.log(data);
		return data;
	}

	function recomputeExpandedNodes() {
		if (childDepth < parsedMaxExpandedDepth) {
			expandNodes(parentChildrenTree);
		}
	}

	//#endregion

	//#region checkboxes
	//checkboxes
	function selectionChanged(node) {
		//console.log(nodePath);
		tree = ChangeSelection(
			recursive,
			tree,
			node.nodePath,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
		selectionEvents(node);
	}

	//selectes
	function selectChildren(node, e) {
		tree = ChangeSelectForAllChildren(
			tree,
			node.nodePath,
			isChild,
			selectedProperty,
			e.target.checked,
			getParentId,
			filteredTree
		);
		selectionEvents(node);
	}

	//#endregion

	function handleDragStart(e, node) {
		console.log("dragstart from: " + node.nodePath);
		e.dataTransfer.dropEffect = "move";
		e.dataTransfer.setData("node_id", node.nodePath);
		draggedPath = node.nodePath;
	}

	function handleDragDrop(e, node) {
		//should be necesary but just in case
		highlightedNode = null;
		if (!dragAndDrop) return;
		draggedPath = e.dataTransfer.getData("node_id");
		console.log(draggedPath + " dropped on: " + node.nodePath);

		//important to check if timetonest is set, otherwise you could spend 30 minutes fixing this shit :)
		if (timeToNest) {
			canNestTime =
				(dragenterTimestamp ? new Date() - dragenterTimestamp : 1) > timeToNest;
		}

		tree = moveNode(
			tree,
			draggedPath,
			node.nodePath,
			isChild,
			canNest,
			priorityPropery
		);

		//reset props
		dragenterTimestamp = null;
		draggedPath = null;
		highlightedNode = null;

		dispatch("moved", { moved: draggedPath, to: node.nodePath });
	}

	function handleDragOver(e, node) {
		//if you are further away from right then treshold allow nesting
		let diff = e.x - e.target.getBoundingClientRect().x;
		//console.log(diff + " - " + (diff > pixelNestTreshold))
		if (pixelNestTreshold && diff > pixelNestTreshold) {
			canNestPos = true;
		} else {
			canNestPos = false;
		}

		//if you arent dropping parent to child allow drop
		if (dragAndDrop && !node.nodePath.startsWith(draggedPath)) {
			validTarget = true;
			e.preventDefault();
		} else {
			validTarget = false;
		}
	}

	function selectionEvents(node) {
		let val = node[selectedProperty];
		dispatch("selection", {
			path: node.nodePath,
			value: val,
		});
		if (val) {
			dispatch("selected", node.nodePath);
		} else {
			dispatch("unselected", node.nodePath);
		}
	}

	function handleDragEnter(e, node) {
		validTarget = false;
		dragenterTimestamp = new Date();
		// will cause flashing when moving wrom node to node while be able to nest
		//* have to be here if you only use time
		highlightedNode = node;

		if (timeToNest) {
			canNestTime = false;

			clearTimeout(dragTimeout);

			dragTimeout = setTimeout(() => {
				canNestTime = true;
			}, timeToNest);
		}
		e.preventDefault();
	}

	function handleDragEnd(e, node) {
		setTimeout(() => {
			draggedPath = null;
			highlightedNode = null;
		}, 1);
	}

	//computes all visual states when component is first created
	tree = computeInitialVisualStates(
		tree,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	);
</script>

<ul class:treeview={childDepth === 0} class:child-menu={childDepth > 0} class={treeCssClass}>
	{#each parentChildrenTree as node (getNodeId(node))}
		<li class:is-child={isChild(node)} class:has-children={node.hasChildren}>
			<div
				class="tree-item {validTarget &&
				canNest &&
				highlightedNode?.nodePath == node.nodePath
					? expandClass
					: ''} {nodeCssClass}"
				class:div-has-children={node.hasChildren}
				class:hover={validTarget && highlightedNode?.nodePath == node.nodePath}
				draggable={dragAndDrop}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:drop={(e) => handleDragDrop(e, node)}
				on:dragover={(e) => handleDragOver(e, node)}
				on:dragenter={(e) => handleDragEnter(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if node.hasChildren}
					<span on:click={() => toggleExpansion(node)}>
						<i
							class="far {node[expandedProperty] ? expandedToggleCss : collapsedToggleCss}"
							class:fa-minus-square={node[expandedProperty]}
							class:fa-plus-square={!node[expandedProperty]}
						/>
					</span>
				{:else}
					<span />
				{/if}
				{#if checkboxes}
					{#if recursive}
						{#if !hasChildren(tree, node.nodePath)}
							<input
								type="checkbox"
								id={getNodeId(node)}
								on:change={() => selectionChanged(node)}
								checked={node[selectedProperty] ? "false" : ""}
							/>
						{:else if !leafNodeCheckboxesOnly}
							<input
								type="checkbox"
								id={getNodeId(node)}
								on:click={(e) => {
									e.preventDefault;
									selectChildren(node, e);
								}}
								checked={node.__visual_state == "true" ? "false" : ""}
								indeterminate={node.__visual_state == "indeterminate"}
							/>
						{:else if disableOrHide}
							<input
								type="checkbox"
								id={getNodeId(node)}
								onclick="return false;"
								disabled={true}
							/>
						{:else}
							<input
								type="checkbox"
								id={getNodeId(node)}
								onclick="return false;"
								class:invisible={!disableOrHide}
							/>
						{/if}
					{:else}
						<input
							type="checkbox"
							id={getNodeId(node)}
							on:change={() => selectionChanged(node)}
							checked={node[selectedProperty] ? "false" : ""}
						/>
					{/if}
				{/if}
				<slot {node} />
			</div>

			{#if validTarget && canNest && highlightedNode?.nodePath == node.nodePath}
				<div class="insert-line-wrapper">
					<div class="insert-line insert-line-child" />
				</div>
			{/if}
			<!-- {@debug node} -->
			<!--{@debug $_expansionState}-->
			{#if node[expandedProperty] && node.hasChildren}
				<!--tree={tree/*.filter(x => x.nodePath.startsWith(node.nodePath) && x.nodePath !== node.nodePath)*/} -->
				<svelte:self
					{treeId}
					{getId}
					{checkboxes}
					{getParentId}
					{maxExpandedDepth}
					bind:tree
					bind:filteredTree
					{recursive}
					childDepth={childDepth + 1}
					parentId={getId(node)}
					let:node={nodeNested}
					{leafNodeCheckboxesOnly}
					{disableOrHide}
					bind:draggedPath
					bind:dragAndDrop
					on:selection
					on:selected
					on:unselected
					on:expansion
					on:expanded
					on:closed
					bind:highlightedNode
					bind:timeToNest
					bind:pixelNestTreshold
					{expandCallback}
				>
					<slot node={nodeNested} />
				</svelte:self>
			{/if}
			{#if node[expandedProperty] != true && node.hasChildren}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if validTarget && !canNest && highlightedNode?.nodePath == node.nodePath}
				<div class="insert-line-wrapper">
					<div class="insert-line" />
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style lang="sass">
	$treeview-lines: dotted black 1px

	:global
		.treeview
			padding-left: 1em

			> :first-child
				//border-left: none
				padding-left: 1px

			ul, li
				list-style: none
				margin: 0
				padding: 0

			ul
				margin-left: 1.5em

			li
				border: $treeview-lines
				border-width: 0 0 1px 1px
				//padding: 0.3em 0


				&:last-child > ul
					border-left: 1px solid white

				div
					margin-left: 0


				ul
					border-top: $treeview-lines
					margin-left: -1px
					padding-left: 1.25em
					border-left: none
			.has-children
				border-bottom: 0px

			.tree-item
				display: flex
				column-gap: 0.4em
				align-items: center
				background: white
				position: relative
				top: 0.75em
				margin-left: 26px

			.div-has-children
				margin-left: 12px

			.no-arrow
				padding-left: .5rem

			.arrow
				cursor: pointer
				display: inline-block

			.arrowDown
				transform: rotate(90deg)

			.invisible
				visibility: none

			.inserting-highlighted
				color: red
			.hover
				font-weight: bold
			.insert-line
				position: absolute
				top: 0.75em
				left: 0
				z-index: 99
				height: 2px
				width: 200px
				background-color: blue
				display: block
				border-radius: 3px
				margin-left: 2.5em
			.insert-line-child
				margin-left: 5em
				background-color: red

			.insert-line-wrapper
				position: relative


</style>
