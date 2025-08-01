import * as React from 'react';
import type { AccessibilityActionEvent, AccessibilityState } from 'react-native';

import { memoize } from '@fluentui-react-native/framework';
import type { IFocusable } from '@fluentui-react-native/interactive-hooks';
import { usePressableState, useKeyProps, useViewCommandFocus } from '@fluentui-react-native/interactive-hooks';

import type { TabProps, TabInfo } from './Tab.types';
import { TabListContext } from '../TabList/TabListContext';

const defaultAccessibilityActions = [{ name: 'Select' }];

/**
 * Re-usable hook for Tab. win32 specific file that handles press events differently.
 * This hook configures tabs item props and state for Tab.
 *
 * @param props user props sent to Tab
 * @returns configured props and state for Tab
 */
export const useTab = (props: TabProps): TabInfo => {
  const defaultComponentRef = React.useRef<IFocusable>(null);
  const {
    accessibilityActions,
    accessibilityPositionInSet,
    accessibilitySetSize,
    accessibilityState,
    accessible,
    componentRef = defaultComponentRef,
    disabled,
    icon,
    onAccessibilityAction,
    tabKey,
    ...rest
  } = props;
  // Grabs the context information from Tabs (currently selected Tab and client's onTabSelect callback).
  const {
    addTabKey,
    invoked,
    onTabSelect,
    removeTabKey,
    setInvoked,
    setFocusedTabRef,
    selectedKey,
    tabKeys,
    vertical,
    updateDisabledTabs,
    updateTabRef,
    ...tablist
  } = React.useContext(TabListContext);

  const isDisabled = disabled || tablist.disabled;

  const changeSelection = React.useCallback(() => {
    onTabSelect(tabKey);
    componentRef && setFocusedTabRef(componentRef);
  }, [componentRef, setFocusedTabRef, onTabSelect, tabKey]);

  /**
   * In the main useTab file, our onPress callback we pass to usePressableState below is generated by the useOnPressWithFocus hook.
   * The issue with this in win32 is that focus is set before the selection state updates. This causes, when clicking a tab, the narrator
   * to announce the tab twice - once when focus is set, and once when the selection state updates. To fix this, we defer setting focus,
   * when clicked, to the useEffect hook below which runs when the `invoked` variable is changed.
   */
  const handlePressAndDeferFocus = React.useCallback(() => {
    changeSelection();
    setInvoked(true);
  }, [changeSelection, setInvoked]);

  const pressable = usePressableState({
    ...rest,
    onPress: handlePressAndDeferFocus,
  });

  const onKeyProps = useKeyProps(changeSelection, ' ', 'Enter');

  /**
   * This runs on initial render. Here we do two things:
   * - We update the global TabList context to populate its list of all tabKeys.
   * - If a selected key is initially set, we update the initial defaultTabbableElement ref to be the selected element.
   *   This is because the componentRef is not generated until after the initial render.
   */
  React.useEffect(() => {
    // Add tab key to the global TabList context.
    addTabKey(tabKey);
    // Set a defaultTabbableElement if we're the initial selectedKey.
    if (selectedKey === tabKey) {
      componentRef && setFocusedTabRef(componentRef);
    }
    return () => removeTabKey(tabKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    updateTabRef(tabKey, componentRef);
    // Disable exhaustive-deps warning because the hook shouldn't run whenever the excluded dependency, updateTabRef, changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey, componentRef]);

  React.useEffect(() => {
    updateDisabledTabs(tabKey, disabled);
    // Disable exhaustive-deps warning because the hook shouldn't run whenever the excluded dependency, updateDisabledTabs, change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey, disabled]);

  /**
   * Continuing from `handlePressAndDeferFocus`, once we have updated the selection state, we can safely set focus to the correct tab so
   * the narrator will only run once.
   */
  React.useEffect(() => {
    if (invoked && setInvoked && tabKey === selectedKey && !isDisabled) {
      componentRef && setFocusedTabRef(componentRef);
      componentRef?.current?.focus();
      setInvoked(false);
    }
    // Disable exhaustive-deps warning because hook should only run whenever 'invoked' and its setter are updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoked, setInvoked]);

  // Used when creating accessibility properties in mergeSettings below.
  const onAccessibilityActionProp = React.useCallback(
    (event: AccessibilityActionEvent) => {
      if (!isDisabled) {
        switch (event.nativeEvent.actionName) {
          case 'Select':
            changeSelection();
            break;
        }
        onAccessibilityAction && onAccessibilityAction(event);
      }
    },
    [changeSelection, isDisabled, onAccessibilityAction],
  );

  const accessibilityActionsProp = React.useMemo(
    () => (accessibilityActions ? [...defaultAccessibilityActions, ...accessibilityActions] : defaultAccessibilityActions),
    [accessibilityActions],
  );

  return {
    props: {
      ...props,
      ...pressable.props,
      accessible: accessible ?? true,
      accessibilityRole: 'tab',
      accessibilityActions: accessibilityActionsProp,
      accessibilityPositionInSet: accessibilityPositionInSet ?? tabKeys.findIndex((key) => key === tabKey) + 1,
      accessibilityState: getAccessibilityState(isDisabled, selectedKey === tabKey, accessibilityState),
      accessibilitySetSize: accessibilitySetSize ?? tabKeys.length,
      disabled: isDisabled,
      focusable: !isDisabled,
      icon: icon,
      onAccessibilityAction: onAccessibilityActionProp,
      ref: useViewCommandFocus(componentRef),
      tabKey: tabKey,
      ...onKeyProps,
    },
    state: {
      ...pressable.state,
      selected: tabKey === selectedKey,
    },
  };
};

const getAccessibilityState = memoize(getAccessibilityStateWorker);
function getAccessibilityStateWorker(disabled: boolean, selected: boolean, accessibilityState?: AccessibilityState): AccessibilityState {
  if (accessibilityState) {
    return { disabled, selected, ...accessibilityState };
  }
  return { disabled, selected };
}
