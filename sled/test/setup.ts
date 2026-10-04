//  jsdom has no showModal or close: these set and clear `open`, which is
//  what the browser's own do to the attribute.
if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        this.open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        this.open = false;
    };
}

//  jsdom lays nothing out, so it scrolls nothing and has no scrollTo: one
//  that does nothing stands in for the map's.
if (typeof Element !== "undefined") {
    Element.prototype.scrollTo = () => undefined;
}
