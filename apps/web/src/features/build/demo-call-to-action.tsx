import {DemoCallToAction as SharedDemoCallToAction, type DemoCallToActionProps} from '@tof-hub/ui';
import styles from './build.module.css';

/**
 * Demo label with a shimmer and an optional import button: the Build card's demo header (replaced by the signature in
 * the PNG via the `demo-cta` class) and the Optimizer board. `children` adds secondary actions after the button.
 */
export function DemoCallToAction(props:DemoCallToActionProps) {
  return <div className={`demo-cta ${styles.demoCta}`} data-build-edit-skip>
    <SharedDemoCallToAction {...props}/>
  </div>;
}
