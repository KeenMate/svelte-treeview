<script lang="ts">
	import {Tree} from "$lib/index.js"
	import {
		createSampleFilesTree,
		createDepartmentTree,
		createPerformanceTestTree,
		createAnimalsData,
		createZooZonesData,
	} from "$lib/demo/treeData.js"
	import "$lib/demo/variable-override.scss"
	import "$lib/styles/main.scss"
	// import {
	// 	createSampleFilesTree,
	// 	createDepartmentTree,
	// 	createPerformanceTestTree,
	// 	createAnimalsData,
	// 	createZooZonesData,
	// } from "../src/lib/treeData.js";

	// Define component state using Svelte 5 runes
	let filesTreeElement: any = $state()
	let orgTreeElement: any = $state()
	let performanceTreeElement: any = $state()
	let animalsTreeElement: any = $state()
	let zooZonesTreeElement: any = $state()

	let selectedDemo: string = $state("files")
	let isLoading: boolean = $state(false)
	let expandedPath: string = $state("")
	let searchText: string = $state("")

	// Pre-generate data for each demo type
	let filesData = $state(createSampleFilesTree())
	let orgData = $state(createDepartmentTree())
	let performanceData: any[] = $state([])

	// Drag and drop demo data
	let animalsData = $state(createAnimalsData())
	let zooZonesData = $state(createZooZonesData())

	// Drag and drop state
	let draggedAnimal: any = $state(null)

	// Computed value for tree title
	const treeTitle = $derived(
		selectedDemo === "files"
			? "File System Demo"
			: selectedDemo === "org"
				? "Organization Chart Demo"
				: selectedDemo === "performance"
					? "Performance Test"
					: "Drag & Drop Demo"
	)

	// Handle performance data generation with loading state
	$effect(() => {
		if (selectedDemo === "performance" && performanceData.length === 0) {
			performance.mark("performance-data-creation-start")
			performanceData = createPerformanceTestTree(10000, 4) // 10K nodes for demo
			performance.mark("performance-data-creation-end")
			performance.measure(
				"performance-data-creation-duration",
				"performance-data-creation-start",
				"performance-data-creation-end"
			)

			let measure = performance.getEntriesByName(
				"performance-data-creation-duration"
			)[0]
			console.log(`performance-data-creation took: ${measure.duration}ms`)
			// isLoading = true;
			// // Use setTimeout to allow UI to update before creating large tree
			// setTimeout(() => {

			//   isLoading = false;
			// }, 100);
		}
	})

	function onExpandNodes() {
		const activeTree =
			selectedDemo === "files"
				? filesTreeElement
				: selectedDemo === "org"
					? orgTreeElement
					: performanceTreeElement

		if (activeTree) {
			activeTree.expandNodes(expandedPath)
		}
	}

	// Drag and drop handlers
	function onAnimalDragStart(node: any, event: DragEvent) {
		if (node?.data?.type === "animal") {
			draggedAnimal = node
			console.log("🐾 Started dragging:", node.data.name)
		}
	}

	function onZoneDragOver(node: any, event: DragEvent) {
		if (draggedAnimal && node?.data?.type === "subsection") {
			// Check if this zone is appropriate for the animal
			const isValidDrop = isAnimalAllowedInZone(draggedAnimal.data, node.data)

			if (isValidDrop) {
				event.currentTarget?.classList.add("ltree-drop-valid")
				event.currentTarget?.classList.remove("ltree-drop-invalid")
			} else {
				event.currentTarget?.classList.add("ltree-drop-invalid")
				event.currentTarget?.classList.remove("ltree-drop-valid")
			}
			event.currentTarget?.classList.add("ltree-drag-over")
		}
	}

	function onZoneDrop(node: any, draggedNode: any, event: DragEvent) {
		console.log("🚀 ~ onZoneDrop ~ node:", node, draggedNode)
		if (draggedAnimal && node?.data?.type === "subsection") {
			const isValidDrop = isAnimalAllowedInZone(draggedAnimal.data, node.data)

			if (isValidDrop) {
				console.log(`✅ Moved ${draggedAnimal.data.name} to ${node.data.name}`)

				// Here you would implement the actual data movement
				// For demo purposes, we'll just log it
				alert(`Successfully moved ${draggedAnimal.data.name} to ${node.data.name}!`)
			} else {
				console.log(`❌ Cannot move ${draggedAnimal.data.name} to ${node.data.name}`)
				alert(`Cannot move ${draggedAnimal.data.name} to ${node.data.name}. This zone is not suitable for this animal.`)
			}

			// Clean up visual feedback
			event.currentTarget?.classList.remove("ltree-drag-over", "ltree-drop-valid", "ltree-drop-invalid")
		}

		draggedAnimal = null
	}

	function isAnimalAllowedInZone(animal: any, zone: any): boolean {
		// Define compatibility rules
		const zoneCompatibility: Record<string, string[]> = {
			"African Savanna - Lions":      ["high"],
			"African Savanna - Elephants":  ["large", "extra-large"],
			"African Savanna - Zebras":     ["medium", "large"],
			"Asian Plains - Tigers":        ["high"],
			"Asian Plains - Bears":         ["high", "medium"],
			"Asian Plains - Pandas":        ["medium"],
			"Aquatic - Marine Mammals":     [],
			"Aquatic - Fish":               [],
			"Aquatic - Amphibians":         [],
			"Aviary - Large Birds":         ["medium", "large"],
			"Aviary - Small Birds":         ["small"],
			"Aviary - Raptors":             ["high", "medium"],
			"Reptile House - Venomous":     ["high"],
			"Reptile House - Non-venomous": ["low", "medium"],
			"Reptile House - Amphibians":   ["low"]
		}

		const allowedTypes = zoneCompatibility[zone.name] || []

		// Check habitat compatibility
		if (zone.name.includes("Aquatic") && !animal.habitat?.includes("aquatic")) {
			return false
		}
		if (zone.name.includes("Aviary") && animal.habitat !== "sky") {
			return false
		}
		if (zone.name.includes("Reptile") && !["ground", "semi-aquatic"].includes(animal.habitat)) {
			return false
		}

		// Check danger level compatibility for dangerous animals zones
		if (zone.name.includes("Lions") || zone.name.includes("Tigers") || zone.name.includes("Bears")) {
			return animal.dangerLevel === "high"
		}

		// Check size compatibility
		if (allowedTypes.length > 0) {
			return allowedTypes.includes(animal.dangerLevel) || allowedTypes.includes(animal.size)
		}

		return true
	}
</script>

<div class="container-fluid py-4">
	<div class="row">
		<div class="col-12">
			<h1 class="display-4 text-center mb-4">LTree Trie Demo</h1>
			<p class="lead text-center text-muted mb-5">
				Interactive tree visualization using hierarchical data structures
			</p>
		</div>
	</div>

	<div class="row mb-4">
		<div class="col-12 text-center">
			<div class="btn-group" role="group">
				<button
					type="button"
					class="btn"
					class:btn-primary={selectedDemo === "files"}
					class:btn-outline-primary={selectedDemo !== "files"}
					onclick={() => (selectedDemo = "files")}
				>
					📁 File System
				</button>
				<button
					type="button"
					class="btn"
					class:btn-primary={selectedDemo === "org"}
					class:btn-outline-primary={selectedDemo !== "org"}
					onclick={() => (selectedDemo = "org")}
				>
					🏢 Organization
				</button>
				<button
					type="button"
					class="btn"
					class:btn-primary={selectedDemo === "performance"}
					class:btn-outline-primary={selectedDemo !== "performance"}
					onclick={() => (selectedDemo = "performance")}
				>
					⚡ Performance Test
				</button>
				<button
					type="button"
					class="btn"
					class:btn-primary={selectedDemo === "dragdrop"}
					class:btn-outline-primary={selectedDemo !== "dragdrop"}
					onclick={() => (selectedDemo = "dragdrop")}
				>
					🐾 Drag & Drop
				</button>
			</div>
		</div>
	</div>

	<div class="row justify-content-center">
		<div class="col-lg-8 col-md-10 col-12">
			{#if isLoading}
				<div class="card">
					<div class="card-body text-center py-5">
						<div class="spinner-border text-primary mb-3" role="status">
							<span class="visually-hidden">Loading...</span>
						</div>
						<h5>Generating Performance Test Tree</h5>
						<p class="text-muted">Creating 37,500+ nodes...</p>
					</div>
				</div>
			{:else}
				<!-- Search and Controls Section -->
				<div class="card mb-3">
					<div class="card-body">
						<div class="row">
							<div class="col-md-6 mb-3 mb-md-0">
								<label for="searchInput" class="form-label">Search Tree</label>
								<input
									type="text"
									id="searchInput"
									class="form-control"
									placeholder="Type to search nodes..."
									bind:value={searchText}
								/>
								<div class="form-text">
									Search functionality depends on tree configuration
								</div>
							</div>
							<div class="col-md-6">
								<label for="expandNodesPath" class="form-label">Expand Specific Path</label>
								<div class="input-group">
									<input
										type="text"
										id="expandNodesPath"
										class="form-control"
										placeholder="Node path to expand"
										bind:value={expandedPath}
									/>
									<button
										class="btn btn-outline-primary"
										type="button"
										onclick={onExpandNodes}
									>
										Expand
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
				<!-- Files Demo Tree -->
				{#if selectedDemo === "files"}
					<div class="card">
						<Tree
							bind:this={filesTreeElement}
							data={filesData}
							idMember={"path"}
							pathMember={"path"}
							isSorted={true}
							sortCallback={(items) => {
                return items?.sort((a, b) => a.name.localeCompare(b.name));
              }}
							bodyClass="card-body"
							onNodeClicked={(node) => console.log("Node clicked:", node.path)}
							expandIconClass="ltree-icon-expand"
							collapseIconClass="ltree-icon-collapse"
							leafIconClass="ltree-icon-leaf"
							selectedNodeClass="ltree-selected-bold"
							shouldUseInternalSearchIndex={true}
							searchValueMember="name"
							bind:searchText
						>
							{#snippet treeHeader()}
								<div
									class="card-header d-flex justify-content-between align-items-center"
								>
									<div>
										<h3 class="card-title mb-0">{treeTitle}</h3>
										<small class="text-muted">
											{filesData?.length} file system nodes
										</small>
									</div>
									<div class="tree-actions">
										<button
											type="button"
											class="btn btn-outline-primary btn-sm me-2"
											onclick={() => filesTreeElement?.expandAll()}
											title="Expand All Nodes"
										>
											<span class="me-1">📂</span>
											Expand All
										</button>
										<button
											type="button"
											class="btn btn-outline-secondary btn-sm"
											onclick={() => filesTreeElement?.collapseAll()}
											title="Collapse All Nodes"
										>
											<span class="me-1">📁</span>
											Collapse All
										</button>
									</div>
								</div>
							{/snippet}

							{#snippet nodeTemplate(node)}
								{#if node?.data?.icon}
									<span class="node-icon fs-5">{node.data.icon}</span>
								{/if}
								<span class="node-label">
									<strong
										class="text-primary"
									>{node?.data?.name || node?.path}</strong
									>
									{#if node?.data?.size}
										<span class="text-muted ms-2">({node.data.size})</span>
									{/if}
									{#if node?.data?.lastModified}
										<small
											class="text-secondary ms-2"
										>• {node.data.lastModified}</small
										>
									{/if}
								</span>
								<span class="node-path text-muted ms-2">
									<code class="small">{node?.path}</code>
									{#if node?.data?.contentType}
										<small
											class="text-info ms-1"
										>[{node.data.contentType.split("/")[1]}]</small
										>
									{/if}
								</span>
							{/snippet}

							{#snippet noDataFound()}
								<p>No data found</p>
							{/snippet}

							{#snippet contextMenu(node, closeMenu)}
								<button
									class="ltree-context-menu-item"
									onclick={() => { console.log('View', node.path); closeMenu(); }}
								>
									📄 View File
								</button>
								<button
									class="ltree-context-menu-item"
									onclick={() => { console.log('Edit', node.path); closeMenu(); }}
								>
									✏️ Edit
								</button>
								<div class="ltree-context-menu-separator"></div>
								<button
									class="ltree-context-menu-item"
									onclick={() => { console.log('Copy path', node.path); closeMenu(); }}
								>
									📋 Copy Path
								</button>
								{#if node?.data?.type === 'file'}
									<button
										class="ltree-context-menu-item danger"
										onclick={() => { console.log('Delete', node.path); closeMenu(); }}
									>
										🗑️ Delete File
									</button>
								{/if}
							{/snippet}
						</Tree>
					</div>
				{/if}

				<!-- Organization Demo Tree -->
				{#if selectedDemo === "org"}
					<div class="card">
						<Tree
							bind:this={orgTreeElement}
							data={orgData}
							idMember={"path"}
							pathMember={"path"}
							isSorted={true}
							sortCallback={(items) => {
                return items?.sort((a, b) => {
                  // Sort by organization hierarchy
                  if (a.organizationCode && b.organizationCode) {
                    return a.organizationCode.localeCompare(b.organizationCode);
                  }
                  return a.name.localeCompare(b.name);
                });
              }}
							expandIconClass="ltree-icon-expand-plus"
							collapseIconClass="ltree-icon-collapse-minus"
							leafIconClass="ltree-icon-leaf"
							selectedNodeClass="ltree-selected-border"
							shouldUseInternalSearchIndex={true}
							searchValueMember="name"
							bind:searchText
						>
							{#snippet treeHeader()}
								<div
									class="card-header d-flex justify-content-between align-items-center"
								>
									<div>
										<h3 class="card-title mb-0">{treeTitle}</h3>
										<small class="text-muted">
											{orgData?.length} organizational nodes
										</small>
									</div>
									<div class="tree-actions">
										<button
											type="button"
											class="btn btn-outline-primary btn-sm me-2"
											onclick={() => orgTreeElement?.expandAll()}
											title="Expand All Nodes"
										>
											<span class="me-1">📂</span>
											Expand All
										</button>
										<button
											type="button"
											class="btn btn-outline-secondary btn-sm"
											onclick={() => orgTreeElement?.collapseAll()}
											title="Collapse All Nodes"
										>
											<span class="me-1">📁</span>
											Collapse All
										</button>
									</div>
								</div>
							{/snippet}

							{#snippet nodeTemplate(node)}
								{#if node?.data?.icon}
									<span class="node-icon fs-4">{node.data.icon}</span>
								{/if}
								<span class="node-label">
									<strong
										class="text-dark"
									>{node?.data?.name || node?.path}</strong
									>
									{#if node?.data?.manager}
										<small class="text-primary ms-2">
											👤 {node.data.manager}
										</small>
									{/if}
									{#if node?.data?.employeeCount !== undefined && node.data.employeeCount > 0}
										<span class="badge bg-secondary ms-2">
											{node.data.employeeCount}
											{node.data.employeeCount === 1 ? "employee" : "employees"}
										</span>
									{/if}
								</span>
								<span class="node-path text-muted ms-2">
									<code
										class="small bg-light px-1 rounded"
									>{node?.data?.organizationCode || node?.path}</code
									>
									{#if node?.data?.type}
										<small class="text-success ms-1">[{node.data.type}]</small>
									{/if}
								</span>
							{/snippet}

							{#snippet noDataFound()}
								<p>No data found</p>
							{/snippet}

							{#snippet contextMenu(node, closeMenu)}
								<button
									class="ltree-context-menu-item"
									onclick={() => { console.log('View org', node.path); closeMenu(); }}
								>
									👥 View Department
								</button>
								{#if node?.data?.manager}
									<button
										class="ltree-context-menu-item"
										onclick={() => { console.log('Contact manager:', node.data.manager); closeMenu(); }}
									>
										📧 Contact Manager
									</button>
								{/if}
								<div class="ltree-context-menu-separator"></div>
								<button
									class="ltree-context-menu-item"
									onclick={() => { orgTreeElement.expandNodes(node.path); closeMenu(); }}
								>
									🌳 Expand All Below
								</button>
								<button
									class="ltree-context-menu-item"
									onclick={() => { console.log('Export org chart', node.path); closeMenu(); }}
								>
									📊 Export Chart
								</button>
							{/snippet}
						</Tree>
					</div>
				{/if}

				<!-- Performance Demo Tree -->
				{#if selectedDemo === "performance"}
					<div class="card">
						<Tree
							bind:this={performanceTreeElement}
							treeId="performance"
							data={performanceData}
							idMember={"path"}
							pathMember={"path"}
							isSorted={true}
							sortCallback={(items) => {
                return items?.sort((a, b) => {
                  // Natural sort for numeric paths
                  const aParts = a.path.split(".").map((x) => parseInt(x) || x);
                  const bParts = b.path.split(".").map((x) => parseInt(x) || x);

                  for (
                    let i = 0;
                    i < Math.min(aParts.length, bParts.length);
                    i++
                  ) {
                    if (aParts[i] !== bParts[i]) {
                      if (
                        typeof aParts[i] === "number" &&
                        typeof bParts[i] === "number"
                      ) {
                        return (aParts[i] as number) - (bParts[i] as number);
                      }
                      return String(aParts[i]).localeCompare(String(bParts[i]));
                    }
                  }
                  return aParts.length - bParts.length;
                });
              }}
							getDisplayValueCallback={(node) =>
                `${node.data.name} (${node.data.itemCount})`}
							expandIconClass="ltree-icon-expand-arrow"
							collapseIconClass="ltree-icon-collapse-arrow"
							leafIconClass="ltree-icon-leaf"
							selectedNodeClass="ltree-selected-brackets"
							shouldUseInternalSearchIndex={true}
							searchValueMember="name"
							bind:searchText
						>
							{#snippet treeHeader()}
								<div
									class="card-header d-flex justify-content-between align-items-center"
								>
									<div>
										<h3 class="card-title mb-0">{treeTitle}</h3>
										<small class="text-muted">
											{performanceData?.length} performance test nodes
										</small>
									</div>
									<div class="tree-actions">
										<button
											type="button"
											class="btn btn-outline-primary btn-sm me-2"
											onclick={() => performanceTreeElement?.expandAll()}
											title="Expand All Nodes"
										>
											<span class="me-1">📂</span>
											Expand All
										</button>
										<button
											type="button"
											class="btn btn-outline-secondary btn-sm"
											onclick={() => performanceTreeElement?.collapseAll()}
											title="Collapse All Nodes"
										>
											<span class="me-1">📁</span>
											Collapse All
										</button>
									</div>
								</div>
							{/snippet}

							{#snippet noDataFound()}
								<p>No data found</p>
							{/snippet}
						</Tree>
					</div>
				{/if}

				<!-- Drag & Drop Demo -->
				{#if selectedDemo === "dragdrop"}
					<div class="row">
						<div class="col-md-6 mb-3 mb-md-0">
							<div class="card">
								<Tree
									bind:this={animalsTreeElement}
									treeId="animals"
									data={animalsData}
									idMember={"path"}
									pathMember={"path"}
									isSorted={true}
									sortCallback={(items) => {
                    return items?.sort((a, b) => {
                      // Sort categories first, then animals within categories
                      if (a.type !== b.type) {
                        return a.type === 'category' ? -1 : 1;
                      }
                      return a.name.localeCompare(b.name);
                    });
                  }}
									bodyClass="card-body"
									expandIconClass="ltree-icon-expand"
									collapseIconClass="ltree-icon-collapse"
									leafIconClass="ltree-icon-leaf"
									selectedNodeClass="ltree-selected-bold"
									shouldUseInternalSearchIndex={true}
									searchValueMember="name"
									bind:searchText
									onNodeDragStart={onAnimalDragStart}
								>
									{#snippet treeHeader()}
										<div class="card-header d-flex justify-content-between align-items-center">
											<div>
												<h4 class="card-title mb-0">🐾 Animals</h4>
												<small class="text-muted">
													Drag animals to zoo zones →
												</small>
											</div>
											<div class="tree-actions">
												<button
													type="button"
													class="btn btn-outline-primary btn-sm me-2"
													onclick={() => animalsTreeElement?.expandAll()}
													title="Expand All Categories"
												>
													📂 Expand All
												</button>
												<button
													type="button"
													class="btn btn-outline-secondary btn-sm"
													onclick={() => animalsTreeElement?.collapseAll()}
													title="Collapse All Categories"
												>
													📁 Collapse All
												</button>
											</div>
										</div>
									{/snippet}

									{#snippet nodeTemplate(node)}
										<div class="d-flex align-items-center">
											{#if node?.data?.icon}
												<span class="node-icon fs-5 me-2">{node.data.icon}</span>
											{/if}
											<div class="flex-grow-1">
												<span class="node-label">
													<strong class={node.data.type === 'category' ? 'text-primary' : 'text-dark'}>
														{node?.data?.name || node?.path}
													</strong>
													{#if node?.data?.species}
														<small class="text-muted ms-2">({node.data.species})</small>
													{/if}
												</span>
												{#if node?.data?.habitat || node?.data?.dangerLevel || node?.data?.size}
													<div class="mt-1">
														{#if node?.data?.habitat}
															<span class="badge bg-info text-dark me-1">{node.data.habitat}</span>
														{/if}
														{#if node?.data?.dangerLevel}
															<span class="badge bg-{node.data.dangerLevel === 'high' ? 'danger' : node.data.dangerLevel === 'medium' ? 'warning' : 'success'} me-1">
																{node.data.dangerLevel} risk
															</span>
														{/if}
														{#if node?.data?.size}
															<span class="badge bg-secondary me-1">{node.data.size}</span>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									{/snippet}

									{#snippet noDataFound()}
										<p>No animals found</p>
									{/snippet}

									{#snippet contextMenu(node, closeMenu)}
										<button
											class="ltree-context-menu-item"
											onclick={() => { console.log('View animal info:', node.data); closeMenu(); }}
										>
											🔍 Animal Info
										</button>
										{#if node?.data?.type === 'animal'}
											<button
												class="ltree-context-menu-item"
												onclick={() => { console.log('Feed animal:', node.data.name); closeMenu(); }}
											>
												🥩 Feed Animal
											</button>
											<div class="ltree-context-menu-separator"></div>
											<button
												class="ltree-context-menu-item"
												onclick={() => { console.log('Move to zone:', node.data.name); closeMenu(); }}
											>
												🚚 Move to Zone
											</button>
										{/if}
									{/snippet}
								</Tree>
							</div>
						</div>

						<div class="col-md-6">
							<div class="card">
								<Tree
									bind:this={zooZonesTreeElement}
									treeId="zoo"
									data={zooZonesData}
									idMember={"path"}
									pathMember={"path"}
									isSorted={true}
									sortCallback={(items) => {
                    return items?.sort((a, b) => {
                      // Sort zones first, then subsections
                      if (a.type !== b.type) {
                        return a.type === 'zone' ? -1 : 1;
                      }
                      return a.name.localeCompare(b.name);
                    });
                  }}
									bodyClass="card-body"
									expandIconClass="ltree-icon-expand"
									collapseIconClass="ltree-icon-collapse"
									leafIconClass="ltree-icon-leaf"
									selectedNodeClass="ltree-selected-border"
									shouldUseInternalSearchIndex={true}
									searchValueMember="name"
									bind:searchText
									onNodeDragOver={onZoneDragOver}
									onNodeDrop={onZoneDrop}
								>
									{#snippet treeHeader()}
										<div class="card-header d-flex justify-content-between align-items-center">
											<div>
												<h4 class="card-title mb-0">🏛️ Zoo Zones</h4>
												<small class="text-muted">
													← Drop animals here
												</small>
											</div>
											<div class="tree-actions">
												<button
													type="button"
													class="btn btn-outline-primary btn-sm me-2"
													onclick={() => zooZonesTreeElement?.expandAll()}
													title="Expand All Zones"
												>
													📂 Expand All
												</button>
												<button
													type="button"
													class="btn btn-outline-secondary btn-sm"
													onclick={() => zooZonesTreeElement?.collapseAll()}
													title="Collapse All Zones"
												>
													📁 Collapse All
												</button>
											</div>
										</div>
									{/snippet}

									{#snippet nodeTemplate(node)}
										<div class="d-flex align-items-center">
											{#if node?.data?.icon}
												<span class="node-icon fs-5 me-2">{node.data.icon}</span>
											{/if}
											<div class="flex-grow-1">
												<span class="node-label">
													<strong class={node.data.type === 'zone' ? 'text-success' : 'text-dark'}>
														{node?.data?.name || node?.path}
													</strong>
												</span>
												{#if node?.data?.capacity || node?.data?.currentAnimals}
													<div class="mt-1">
														{#if node?.data?.capacity}
															<span class="badge bg-primary me-1">
																{node.data.currentAnimals || 0}/{node.data.capacity} capacity
															</span>
														{/if}
														{#if node?.data?.features && node.data.features.length > 0}
															{#each node.data.features as feature}
																<span class="badge bg-light text-dark me-1">{feature}</span>
															{/each}
														{/if}
													</div>
												{/if}
												{#if node?.data?.description}
													<small class="text-muted d-block mt-1">{node.data.description}</small>
												{/if}
											</div>
										</div>
									{/snippet}

									{#snippet noDataFound()}
										<p>No zoo zones found</p>
									{/snippet}

									{#snippet contextMenu(node, closeMenu)}
										<button
											class="ltree-context-menu-item"
											onclick={() => { console.log('Zone details:', node.data); closeMenu(); }}
										>
											ℹ️ Zone Details
										</button>
										{#if node?.data?.type === 'subsection'}
											<button
												class="ltree-context-menu-item"
												onclick={() => { console.log('View animals in:', node.data.name); closeMenu(); }}
											>
												👀 View Animals
											</button>
											<div class="ltree-context-menu-separator"></div>
											<button
												class="ltree-context-menu-item"
												onclick={() => { console.log('Clean zone:', node.data.name); closeMenu(); }}
											>
												🧹 Clean Zone
											</button>
										{/if}
									{/snippet}
								</Tree>
							</div>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style lang="scss">
	@import "$lib/demo/demo";

	.card {
		max-width: 100%;
		margin: 0 auto;
	}

	.card-header {
		background-color: var(--bs-light);
		border-bottom: 1px solid var(--bs-border-color);
		padding: 1rem;
	}

	.card-title {
		color: var(--bs-dark);
		font-size: 1.25rem;
	}

	.tree-actions {
		display: flex;
		gap: 0.5rem;
	}

	.tree-actions .btn {
		font-size: 0.875rem;
		white-space: nowrap;
	}

	/* Responsive behavior for smaller screens */
	@media (max-width: 576px) {
		.card-header {
			flex-direction: column !important;
			align-items: flex-start !important;
			gap: 0.75rem;
		}

		.tree-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.tree-actions .btn {
			font-size: 0.8rem;
			padding: 0.375rem 0.5rem;
		}
	}
</style>
