<script lang="ts">
	import { Card, LteButton, AutoScroll, TableCondensed } from '@keenmate/svelte-adminlte';
	export let members: any[];
</script>

<Card noPadding>
	<AutoScroll>
		<TableCondensed class="center-align-cells">
			<tr slot="headers">
				<th class="actions auto-width">Actions</th>
				<th>Username</th>
				<th>Email</th>
			</tr>

			{#each members || [] as item (item.email)}
				<tr>
					<td>
						<LteButton color="danger" xsmall>
							<i class="fas fa-trash fa-fw" />
						</LteButton>
					</td>
					<td>
						{item.username}
					</td>

					<td>
						{item.email}
					</td>
				</tr>
			{/each}
		</TableCondensed>
	</AutoScroll>
</Card>
