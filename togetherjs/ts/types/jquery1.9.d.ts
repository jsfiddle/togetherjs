interface JQueryStatic {
    browser : {
        mobile?: boolean,
        mozilla?: boolean,
        version: string;
    };
    msie: boolean;
}

// Plugins introduced by TogetherJS
interface JQuery {
    browser : { mobile: boolean };
    rotateCursorDown: () => void;
    popinWindow: () => void;
    slideIn: () => void;
    easeTo: (y: number) => void;
    animateDockEntry: () => void;
    animateDockExit: () => void;
    animateCursorEntry: () => void;
    animateKeyboard: () => void;
    stopKeyboardAnimation: () => void;
}