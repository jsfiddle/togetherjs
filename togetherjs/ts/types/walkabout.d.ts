declare namespace WalkaboutNS {

    interface RunManyActionsOptions {
        element?: HTMLElement | Document,
        speed?: number, whileTrue?: () => void,
        ondone: () => void,
        onstatus: (arg: {actions: Actions, action: Action, times: number, remaining: number}) => void,
        times?: number,
        startAtRemaining?: number
    }

    interface Actions extends Array<Action> {
    }

    interface Action {
        show(): Action;
        remove(): void;
        description(): string;
    }
}

interface WalkaboutModule {
    runManyActions(options: WalkaboutNS.RunManyActionsOptions): () => void;
    findActions(): WalkaboutNS.Actions;
}
