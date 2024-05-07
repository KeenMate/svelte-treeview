import { expect } from 'vitest';

export function expectArrayEqual(received: any[], expected: any[]) {
	expect(expected.sort()).toEqual(received.sort());
}
