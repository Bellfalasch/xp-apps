import './../api.ts';
import {ItemViewContextMenu} from './ItemViewContextMenu';
import {PageView} from './PageView';
import {PageViewContextMenuTitle} from './PageViewContextMenuTitle';
import {PageInspectedEvent} from './PageInspectedEvent';
import Action = api.ui.Action;
import i18n = api.util.i18n;
import PageModeChangedEvent = api.content.page.PageModeChangedEvent;
import PageMode = api.content.page.PageMode;

export class PageViewContextMenu extends ItemViewContextMenu {

    private resetAction: Action;

    protected initEventListeners(listenToWizard: boolean) {
        super.initEventListeners(listenToWizard);

        if (!this.resetAction) {
            return;
        }
        
        const pageModeChangedListener = (event: PageModeChangedEvent) => this.toggleResetActionEnabled(event.getNewMode());
        const pageModel = this.getItemView().getLiveEditModel().getPageModel();

        pageModel.onPageModeChanged(pageModeChangedListener);
        this.getItemView().onRemoved(event => pageModel.unPageModeChanged(pageModeChangedListener));
    }

    protected getTitle(): PageViewContextMenuTitle {
        return new PageViewContextMenuTitle(this.getItemView().getLiveEditModel().getContent());
    }

    protected getItemView(): PageView {
        return <PageView>super.getItemView();
    }

    private createResetAction() {
        const pageModel = this.getItemView().getLiveEditModel().getPageModel();

        this.resetAction = new api.ui.Action(i18n('live.view.reset')).onExecuted(() => {
            if (PageView.debug) {
                console.log('PageView.reset');
            }
            this.getItemView().setIgnorePropertyChanges(true);
            pageModel.reset(this);
            this.getItemView().setIgnorePropertyChanges(false);
        });

        this.toggleResetActionEnabled(pageModel.getMode());
    }

    private toggleResetActionEnabled(pageMode: PageMode) {
        let resetEnabled = pageMode !== PageMode.AUTOMATIC && pageMode !== PageMode.NO_CONTROLLER;

        this.resetAction.setEnabled(resetEnabled);
    }

    protected getActions(): Action[] {
        const inspectAction = new api.ui.Action(i18n('live.view.inspect')).onExecuted(() => {
            new PageInspectedEvent().fire();
        });

        this.createResetAction();

        return [inspectAction, this.resetAction];
    }
}