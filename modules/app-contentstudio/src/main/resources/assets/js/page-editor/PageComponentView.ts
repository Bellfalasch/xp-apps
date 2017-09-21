import {ItemView} from './ItemView';
import {PageView} from './PageView';

export class PageComponentView extends ItemView {

    getPageView(): PageView {
        let itemView: ItemView = this;
        while (!itemView.isPage()) {
            itemView = itemView.getParentItemView();
        }
        return <PageView>itemView;
    }
}