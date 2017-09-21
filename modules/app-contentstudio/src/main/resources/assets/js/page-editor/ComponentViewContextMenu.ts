import './../api.ts';
import {ItemViewContextMenu} from './ItemViewContextMenu';
import {ItemViewContextMenuPosition} from './ItemViewContextMenuPosition';
import {ItemView} from './ItemView';
import {ComponentView} from './ComponentView';
import {RegionView} from './RegionView';
import {ContextMenuAction} from './ItemViewContextMenu';
import {ComponentViewContextMenuTitle} from './ComponentViewContextMenuTitle';

import {ComponentInspectedEvent} from './ComponentInspectedEvent';
import {ComponentDuplicatedEvent} from './ComponentDuplicatedEvent';
import {FragmentComponentView} from './fragment/FragmentComponentView';
import {FragmentItemType} from './fragment/FragmentItemType';
import {ComponentFragmentCreatedEvent} from './ComponentFragmentCreatedEvent';

import {CreateItemViewConfig} from './CreateItemViewConfig';
import {FragmentItemType} from './fragment/FragmentItemType';
import {TextItemType} from './text/TextItemType';
import {LayoutItemType} from './layout/LayoutItemType';
import {PartItemType} from './part/PartItemType';
import {ImageItemType} from './image/ImageItemType';
import {ItemType} from './ItemType';


import Action = api.ui.Action;
import i18n = api.util.i18n;

export class ComponentViewContextMenu extends ItemViewContextMenu<ComponentView> {

    protected getTitle(): ComponentViewContextMenuTitle {
        return new ComponentViewContextMenuTitle(this.getItemView().getComponent(), this.getItemView().getType());
    }

    getActions(): ContextMenuAction[] {
        let isFragmentContent = this.getItemView().hasFragmentContent();
        let parentIsPage = this.getItemView().getParentItemView().isPage();
        let isTopFragmentComponent = parentIsPage && isFragmentContent;

        let actions: ContextMenuAction[] = [];

        if (!isTopFragmentComponent) {
            actions.push(this.createSelectParentAction());
            actions.push(this.createInsertAction());
        }

        if (this.inspectActionRequired) {
            actions.push(this.createInspectAction());
        }

        actions.push(this.createResetAction());

        if (!isTopFragmentComponent) {
            actions.push(this.createRemoveAction());
            actions.push(this.createDuplicateAction());
        }

        if (!this.getItemView().isFragment() && this.getItemView().getLiveEditModel().isFragmentAllowed()) {
            actions.push(this.createFragmentAction());
        }

        return actions;
    }

    private getInsertActions(): api.ui.Action[] {
        const hasFragmentContent = this.getItemView().hasFragmentContent();

        const actions = [
            this.createInsertSubAction('image', ImageItemType.get()),
            this.createInsertSubAction('part', PartItemType.get())
        ];

        const isInRegion = this.getItemView().isInRegion() || this.getItemView().isRegion();
        if (isInRegion && !this.getItemView().isRegionInsideLayout() && !hasFragmentContent) {
            actions.push(this.createInsertSubAction('layout', LayoutItemType.get()));
        }
        actions.push(this.createInsertSubAction('text', TextItemType.get()));
        actions.push(this.createInsertSubAction('fragment', FragmentItemType.get()));

        return actions;
    }

    private createInsertAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('action.insert')).setChildActions(this.getInsertActions());
        
        return this.createAction(action);
    }

    private createSelectParentAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.selectparent'));

        action.setSortOrder(0);
        action.onExecuted(() => {
            let parentView: ItemView = this.getItemView().getParentItemView();
            if (parentView) {
                this.getItemView().deselect();
                parentView.select(null, ItemViewContextMenuPosition.TOP, false, true);
                parentView.scrollComponentIntoView();
            }
        });

        return this.createAction(action);
    }

    private createInsertSubAction(label: string, componentItemType: ItemType): api.ui.Action {
        let action = new api.ui.Action(i18n('live.view.insert.' + label)).onExecuted(() => {
            let componentView = this.createComponentView(componentItemType);
            this.addComponentView(componentView, this.getNewItemIndex(), true);
        });

        action.setIconClass(api.StyleHelper.getCommonIconCls(label));

        return action;
    }

    protected createComponentView(componentItemType: ItemType): ItemView {
        let regionView = this.getItemView().getRegionView();
        let newComponent = regionView.createComponent(componentItemType.toComponentType());

        return componentItemType.createView(
            new CreateItemViewConfig<RegionView, Component>().setParentView(regionView).setParentElement(regionView).setData(newComponent));
    }

    private createInspectAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.inspect')).onExecuted(() => {
            new ComponentInspectedEvent(this.getItemView()).fire();
        });

        return this.createAction(action);
    }

    private createResetAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.reset')).onExecuted(() => {
            if (this.getItemView().getComponent()) {
                this.getItemView().getComponent().reset();
            }
        });

        return this.createAction(action);
    }

    private createRemoveAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.remove')).onExecuted(() => {
            this.getItemView().deselect();
            this.getItemView().remove();
        });

        return this.createAction(action);
    }

    private createDuplicateAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.duplicate')).onExecuted(() => {
            this.getItemView().deselect();

            let duplicatedComponent = this.getItemView().getComponent().duplicate();
            let duplicatedView = this.getItemView().duplicate(duplicatedComponent);

            duplicatedView.showLoadingSpinner();

            new ComponentDuplicatedEvent(this.getItemView(), duplicatedView).fire();
        });

        return this.createAction(action);
    }

    private createFragmentAction(): ContextMenuAction {
        const action = new api.ui.Action(i18n('live.view.create.fragment')).onExecuted(() => {
            this.getItemView().deselect();
            this.getItemView().createFragment().then((content: Content): void => {
                // replace created fragment in place of source component
                let fragmentCmpView = <FragmentComponentView> this.createComponentView(FragmentItemType.get());
                fragmentCmpView.getComponent().setFragment(content.getContentId(), content.getDisplayName());
                this.getItemView().addComponentView(fragmentCmpView, this.getItemView().getNewItemIndex());
                this.getItemView().remove();
                new ComponentFragmentCreatedEvent(fragmentCmpView, this.getItemView().getComponent().getType(), content).fire();
            });
        });

        return this.createAction(action);
    }
}