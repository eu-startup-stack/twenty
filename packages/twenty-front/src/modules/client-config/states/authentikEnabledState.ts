import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const authentikEnabledState = createAtomState<boolean>({
  key: 'authentikEnabled',
  defaultValue: false,
});
