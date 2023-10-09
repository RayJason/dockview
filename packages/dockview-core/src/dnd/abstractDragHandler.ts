import { getElementsByTagName } from '../dom';
import { addDisposableListener, Emitter } from '../events';
import {
    CompositeDisposable,
    IDisposable,
    MutableDisposable,
} from '../lifecycle';

const CLONE_ELEMENT = true;

export abstract class DragHandler extends CompositeDisposable {
    private readonly dataDisposable = new MutableDisposable();
    private readonly pointerEventsDisposable = new MutableDisposable();

    private readonly _onDragStart = new Emitter<DragEvent>();
    readonly onDragStart = this._onDragStart.event;

    constructor(protected readonly el: HTMLElement) {
        super();

        this.addDisposables(
            this._onDragStart,
            this.dataDisposable,
            this.pointerEventsDisposable
        );

        this.configure();
    }

    abstract getData(event: DragEvent): IDisposable;

    protected isCancelled(_event: DragEvent): boolean {
        return false;
    }

    private configure(): void {
        this.addDisposables(
            this._onDragStart,
            addDisposableListener(this.el, 'dragstart', (event) => {
                if (event.defaultPrevented || this.isCancelled(event)) {
                    event.preventDefault();
                    return;
                }

                const iframes = [
                    ...getElementsByTagName('iframe'),
                    ...getElementsByTagName('webview'),
                ];

                this.pointerEventsDisposable.value = {
                    dispose: () => {
                        for (const iframe of iframes) {
                            iframe.style.pointerEvents = 'auto';
                        }
                    },
                };

                for (const iframe of iframes) {
                    iframe.style.pointerEvents = 'none';
                }

                if (CLONE_ELEMENT && event.dataTransfer) {
                    const clone = this.el.cloneNode(true) as HTMLElement;
                    const styles = window.getComputedStyle(this.el);
                    clone.style.cssText = Object.values(styles)
                        .map((key) => `${key}:${styles.getPropertyValue(key)}`)
                        .join(';');
                    clone.classList.add('dv-dragged');

                    document.body.append(clone);
                    setTimeout(() => {
                        // clone.parentElement?.removeChild(clone);
                    }, 0);

                    event.dataTransfer.setDragImage(clone, 0, 0);
                } else {
                    this.el.classList.add('dv-dragged');
                    setTimeout(() => this.el.classList.remove('dv-dragged'), 0);
                }

                this.dataDisposable.value = this.getData(event);
                this._onDragStart.fire(event);

                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';

                    const hasData = event.dataTransfer.items.length > 0;

                    if (!hasData) {
                        /**
                         * Although this is not used by dockview many third party dnd libraries will check
                         * dataTransfer.types to determine valid drag events.
                         *
                         * For example: in react-dnd if dataTransfer.types is not set then the dragStart event will be cancelled
                         * through .preventDefault(). Since this is applied globally to all drag events this would break dockviews
                         * dnd logic. You can see the code at
                         * https://github.com/react-dnd/react-dnd/blob/main/packages/backend-html5/src/HTML5BackendImpl.ts#L542
                         */
                        event.dataTransfer.setData(
                            'text/plain',
                            '__dockview_internal_drag_event__'
                        );
                    }
                }
            }),
            addDisposableListener(this.el, 'dragend', () => {
                this.pointerEventsDisposable.dispose();
                this.dataDisposable.dispose();
            })
        );
    }
}
