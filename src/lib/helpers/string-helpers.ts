export const isEmptyString = (str: string | null | undefined): boolean => 
  !str || (typeof str === 'string' && str.trim() === '');
export const isNotEmptyString = (str: string | null | undefined) => str && str.trim() !== "";
