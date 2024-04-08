import { expect, test } from 'vitest';
import { PropertyHelper } from '$lib/helpers/property-helper.js';
import { Props, visualStates } from '$lib/types.js';

const testingProperties: Props = {
	nodePath: 'nodePath2',
	hasChildren: 'hasChildren2',
	expanded: '__expanded2',
	selected: '__selected2',
	useCallback: '__useCallback2',
	priority: 'priority2',
	isDraggable: 'isDraggable2',
	insertDisabled: 'insertDisabled2',
	nestDisabled: 'nestDisabled2',
	checkbox: 'checkbox2',
	visualState: '__visual_state2'
};

function getPropertyHelper(): PropertyHelper {
	return new PropertyHelper(testingProperties);
}

test('get and set path', () => {
	const helper = getPropertyHelper();
	const testPath = 'test';

	const obj = {};
	helper.setPath(obj, testPath);
	expect(helper.path(obj)).toBe(testPath);
});

test('get and set hasChildren', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setHasChildren(obj, true);
	expect(helper.hasChildren(obj)).toBe(true);
});

test('get and set expanded', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setExpanded(obj, true);
	expect(helper.expanded(obj)).toBe(true);
});

test('get and set selected', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setSelected(obj, true);
	expect(helper.selected(obj)).toBe(true);
});

test('get and set useCallback', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setUseCallback(obj, true);
	expect(helper.useCallback(obj)).toBe(true);
});

test('get and set priority', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setPriority(obj, 1);
	expect(helper.priority(obj)).toBe(1);
});

test('get and set isDraggable', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setIsDraggable(obj, true);
	expect(helper.isDraggable(obj)).toBe(true);
});

test('get and set insertDisabled', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setInsertDisabled(obj, true);
	expect(helper.insertDisabled(obj)).toBe(true);
});

test('get and set nestDisabled', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setNestDisabled(obj, true);
	expect(helper.nestDisabled(obj)).toBe(true);
});

test('get and set checkbox', () => {
	const helper = getPropertyHelper();
	const obj = {};
	helper.setCheckbox(obj, true);
	expect(helper.checkbox(obj)).toBe(true);
});

test('get and set visualState', () => {
	const helper = getPropertyHelper();
	const obj = {};
	const setTo = visualStates.selected;
	helper.setVisualState(obj, setTo);
	expect(helper.visualState(obj)).toBe(setTo);
});
