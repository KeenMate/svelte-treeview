<script>
	import { Card, Tabs, TabItem } from '@keenmate/svelte-adminlte';
	import MembersCard from './MembersCard.svelte';
	import RulesCard from './RulesCard.svelte';
	import UsersCard from './UsersCard.svelte';

	const tabs = {
		members: 'members',
		users: 'user',
		rules: 'scopes'
	};

	let selectedTab = tabs.members;
	/**
	 * @param {string} changeTo
	 */
	function changeTab(changeTo) {
		console.debug('changeTab', changeTo);
		selectedTab = changeTo;
	}

	/**
	 * @type {{ name: any; members: any; rules: any; }}
	 */
	export let node;
</script>

<Card noPadding>
	<svelte:fragment slot="header">
		<span class="card-header-title">
			Scope: <b> {node.name}</b>
		</span>
	</svelte:fragment>
</Card>

<Tabs>
	<TabItem active={selectedTab == tabs.members} on:click={() => changeTab(tabs.members)}>
		Members
	</TabItem>
	<TabItem active={selectedTab == tabs.users} on:click={() => changeTab(tabs.users)}>Users</TabItem>
	<TabItem active={selectedTab == tabs.rules} on:click={() => changeTab(tabs.rules)}>Rules</TabItem>
</Tabs>
{#if selectedTab == tabs.members}
	<MembersCard members={node.members} />
{:else if selectedTab == tabs.users}
	<UsersCard />
{:else if selectedTab == tabs.rules}
	<RulesCard rules={node.rules} />
{/if}
