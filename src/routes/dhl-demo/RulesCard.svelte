<script lang="ts">
	import {
		Card,
		AutoScroll,
		TableCondensed,
		LteButton,
		TextInput
	} from '@keenmate/svelte-adminlte';
	import { Multiselect } from 'svelte-multiselect';

	const fields = ['country', 'region', 'property'];
	type rule = { name: string; value: string };
	export let rules: rule[];
</script>

<Card noPadding>
	<TableCondensed class="center-align-cells">
		<tr slot="headers">
			<th class="actions auto-width"></th>
			<th>Field</th>
			<th>Value</th>
		</tr>

		{#each [...rules, { name: null, value: '' }] || [] as item (item.name)}
			<tr>
				<td>
					{#if item.name !== null}
						<LteButton color="danger" xsmall>
							<i class="fas fa-trash fa-fw" />
						</LteButton>
					{/if}
				</td>
				<td>
					<Multiselect value={item.name} options={fields} small />
				</td>

				<td>
					<TextInput type="text" value={item.value} size="sm" />
				</td>
			</tr>
		{/each}
	</TableCondensed>
</Card>
