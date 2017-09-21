import './../api.ts';
import {ItemView} from './ItemView';
import {ItemViewContextMenuTitle} from './ItemViewContextMenuTitle';
import MinimizeWizardPanelEvent = api.app.wizard.MinimizeWizardPanelEvent;
import Action = api.ui.Action;

export enum ItemViewContextMenuOrientation {
    UP,
    DOWN
}

export interface ContextMenuAction {
    index: number;
    action: Action;
}

export class ItemViewContextMenuBuilder<I> {

    itemView: I;

    showArrow: boolean = true;

    listenToWizard: boolean = true;

    inspectActionRequired: boolean = true;

    setItemView(itemView: I): ItemViewContextMenuBuilder {
        this.itemView = itemView;

        return this;
    }

    hideArrow(): ItemViewContextMenuBuilder {
        this.showArrow = false;

        return this;
    }

    ignoreWizard(): ItemViewContextMenuBuilder {
        this.listenToWizard = false;

        return this;
    }

    hideInspectAction(): ItemViewContextMenuBuilder {
        this.inspectActionRequired = false;

        return this;
    }

    build(): ItemViewContextMenu<I> {
        return new ItemViewContextMenu<I>(this);
    }
}

export class ItemViewContextMenu<I extends ItemView> extends api.dom.DivEl {

    private itemView: I;
    private title: ItemViewContextMenuTitle;
    private menu: api.ui.menu.TreeContextMenu;
    private arrow: ItemViewContextMenuArrow;
    private orientation: ItemViewContextMenuOrientation = ItemViewContextMenuOrientation.DOWN;
    private lastPosition: { x: number, y: number };

    private orientationListeners: { (orientation: ItemViewContextMenuOrientation): void }[] = [];

    protected actions: ContextMenuAction[];
    protected inspectActionRequired: boolean;

    constructor(builder: ItemViewContextMenuBuilder<I>) {
        super('menu item-view-context-menu');

        this.itemView = builder.itemView;
        this.inspectActionRequired = builder.inspectActionRequired;

        if (builder.showArrow) {
            this.arrow = new ItemViewContextMenuArrow();
            this.appendChild(this.arrow);
        }

        this.initTitle();
        this.initActions();

        this.initEventListeners(builder.listenToWizard);

        api.dom.Body.get().appendChild(this);
    }

    protected initEventListeners(listenToWizard: boolean) {
        let lastPosition;

        const dragListener = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const x = e.pageX;
            const y = e.pageY;

            this.moveBy(x - lastPosition.x, y - lastPosition.y);
            lastPosition = {x, y};
        };

        const upListener = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            this.stopDrag(dragListener, upListener);
        };

        this.onClicked((e: MouseEvent) => {
            // menu itself was clicked so do nothing
            e.preventDefault();
            e.stopPropagation();
        });

        this.onHidden((e: api.dom.ElementHiddenEvent) => {
            // stop drag if the element was hidden while dragging
            this.stopDrag(dragListener, upListener);
        });


        this.onOrientationChanged((orientation: ItemViewContextMenuOrientation) => {
            const dimensions = this.getItemView().getEl().getDimensions();

            // move menu to the top edge of empty view in order to not overlay it
            if (orientation === ItemViewContextMenuOrientation.UP && this.getItemView().isEmpty()) {
                this.getEl().setMarginTop('-' + dimensions.height + 'px');
            } else {
                this.getEl().setMarginTop('0px');
            }
        });
        
        if (this.title) {
            this.title.onMouseDown((e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.lastPosition = {
                    x: e.pageX,
                    y: e.pageY
                };

                this.startDrag(dragListener, upListener);
            });
        }
        
        if (this.menu) {
            this.menu.onItemClicked(() => {
                this.hide();
            });
        }

        if (listenToWizard) {
            const minimizeHandler = () => {
                this.hide();
            };

            MinimizeWizardPanelEvent.on(minimizeHandler);

            this.onRemoved(() => MinimizeWizardPanelEvent.un(minimizeHandler));
        }
    }

    protected getTitle(): ItemViewContextMenuTitle {
        throw new Error('Must be implemented by inheritors');
    }

    protected createAction(action: Action, index?: number): ContextMenuAction {
       return {
            index: index || this.actions.length,
            action: action
        };
    }

    protected addAction(action: Action, index?: number) {
        const action = this.createAction(action, index);
        this.actions.push(action);
    }

    protected getActions(): ContextMenuAction[] {
        //throw new Error('Must be implemented by inheritors');
        return this.actions;
    }

    private initTitle() {
        this.title = this.getTitle();

        this.appendChild(this.title);
    }

    private initActions() {
        if (this.menu) {
            this.removeChild(this.menu);
        }

        this.menu = new api.ui.menu.TreeContextMenu(this.getSortedActions(), false);
        this.appendChild(this.menu);
    }

    showAt(x: number, y: number, notClicked: boolean = false) {
        this.menu.showAt.call(this, this.restrainX(x), this.restrainY(y, notClicked));
    }

    moveBy(dx: number, dy: number) {
        this.menu.moveBy.call(this, dx, dy);
    }

    setActions(actions: ContextMenuAction[]) {
        this.menu.setActions(actions);
    }

    getMenu(): api.ui.menu.TreeContextMenu {
        return this.menu;
    }

    private getOrientation(): ItemViewContextMenuOrientation {
        return this.orientation;
    }

    private setOrientation(orientation: ItemViewContextMenuOrientation) {
        if (this.orientation !== orientation) {
            this.orientation = orientation;
            if (this.arrow) {
                this.arrow.toggleVerticalPosition(orientation === ItemViewContextMenuOrientation.DOWN);
            }
            this.notifyOrientationChanged(orientation);
        }
    }

    private notifyOrientationChanged(orientation: ItemViewContextMenuOrientation) {
        this.orientationListeners.forEach((listener) => {
            listener(orientation);
        });
    }

    onOrientationChanged(listener: (orientation: ItemViewContextMenuOrientation) => void) {
        this.orientationListeners.push(listener);
    }

    unOrientationChanged(listener: (orientation: ItemViewContextMenuOrientation) => void) {
        this.orientationListeners = this.orientationListeners.filter((curr) => {
            return curr !== listener;
        });
    }

    private startDrag(dragListener: (e: MouseEvent) => void, upListener: (e: MouseEvent) => void) {
        api.dom.Body.get().onMouseMove(dragListener);
        api.dom.Body.get().onMouseUp(upListener);
    }

    private stopDrag(dragListener: (e: MouseEvent) => void, upListener: (e: MouseEvent) => void) {
        api.dom.Body.get().unMouseMove(dragListener);
        api.dom.Body.get().unMouseUp(upListener);
    }

    private restrainX(x: number): number {
        let parentEl = this.getParentElement().getEl();

        let width = this.getEl().getWidth();
        let halfWidth = width / 2;
        let arrowHalfWidth = this.arrow ? this.arrow.getWidth() / 2 : 0;
        let desiredX = x - halfWidth;
        let resultX = desiredX;
        let deltaX;
        let arrowPos;
        let minX = parentEl.getMarginLeft();
        let maxX = parentEl.getWidthWithMargin() - parentEl.getMarginRight() - width;

        if (desiredX < minX) {
            deltaX = minX - desiredX;
            arrowPos = Math.max(arrowHalfWidth, halfWidth - deltaX);
            resultX = minX;
        }
        if (desiredX > maxX) {
            deltaX = maxX - desiredX;
            arrowPos = Math.min(halfWidth - deltaX, width - arrowHalfWidth);
            resultX = maxX;
        }
        if (this.arrow && arrowPos) {
            this.arrow.getEl().setLeftPx(arrowPos);
        }
        return resultX;
    }

    private restrainY(y: number, notClicked?: boolean): number {
        let orientation = ItemViewContextMenuOrientation.DOWN;
        let arrowHeight = this.arrow ? this.arrow.getHeight() : 0;
        let height = this.getEl().getHeight();
        let minY = 0;
        let maxY;
        let desiredY;

        if (notClicked) {
            maxY = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        } else {
            maxY = Math.max(document.body.scrollTop, document.documentElement.scrollTop) + window.innerHeight;
        }

        if (orientation === ItemViewContextMenuOrientation.DOWN) {
            // account for arrow
            desiredY = y + arrowHeight + (notClicked ? 0 : 1);
            if (desiredY + height > maxY) {
                orientation = ItemViewContextMenuOrientation.UP;
            }
        }
        if (orientation === ItemViewContextMenuOrientation.UP) {
            // subtract my full height to display above target
            desiredY = y - arrowHeight - height - (notClicked ? 0 : 1);
            if (desiredY < minY) {
                orientation = ItemViewContextMenuOrientation.DOWN;
            }
        }
        this.setOrientation(orientation);
        return desiredY;
    }

    protected getItemView(): I {
        return this.itemView;
    }

    protected getSortedActions(): Action[] {
        return this.getActions().sort((actionItem1, actionItem2) => actionItem1.index - actionItem2.index).map(actionItem => actionItem.action);
    }

}

export class ItemViewContextMenuArrow
    extends api.dom.DivEl {
    private static clsBottom: string = 'bottom';
    private static clsTop: string = 'top';
    private static clsLeft: string = 'left';
    private static clsRight: string = 'right';

    constructor() {
        super('item-view-context-menu-arrow ' + ItemViewContextMenuArrow.clsBottom);
    }

    toggleVerticalPosition(bottom: boolean) {
        this.toggleClass(ItemViewContextMenuArrow.clsBottom, bottom);
        this.toggleClass(ItemViewContextMenuArrow.clsTop, !bottom);
    }

    getWidth(): number {
        if (this.hasClass(ItemViewContextMenuArrow.clsTop) || this.hasClass(ItemViewContextMenuArrow.clsBottom)) {
            return 14;
        } else if (this.hasClass(ItemViewContextMenuArrow.clsLeft) || this.hasClass(ItemViewContextMenuArrow.clsRight)) {
            return 7;
        }
    }

    getHeight(): number {
        if (this.hasClass(ItemViewContextMenuArrow.clsTop) || this.hasClass(ItemViewContextMenuArrow.clsBottom)) {
            return 7;
        } else if (this.hasClass(ItemViewContextMenuArrow.clsLeft) || this.hasClass(ItemViewContextMenuArrow.clsRight)) {
            return 14;
        }
    }
}
