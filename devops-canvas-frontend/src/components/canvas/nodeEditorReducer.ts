import { CanvasNode, Connection } from '../../types';

export interface NodeEditorState {
    sidebarVisible: boolean;
    showExportModal: boolean;
    showUnsavedModal: boolean;
    showImportModal: boolean;
    terminalConfig: {
        isOpen: boolean;
        componentId: string;
        componentName: string;
        componentType: string;
    } | null;
    lastSaved: Date | null;
    isAutoSaving: boolean;
    hasUnsavedChanges: boolean;
    autoSaveEnabled: boolean;
}

export type NodeEditorAction =
    | { type: 'SET_SIDEBAR_VISIBLE'; payload: boolean }
    | { type: 'SET_SHOW_EXPORT_MODAL'; payload: boolean }
    | { type: 'SET_SHOW_UNSAVED_MODAL'; payload: boolean }
    | { type: 'SET_SHOW_IMPORT_MODAL'; payload: boolean }
    | { type: 'SET_TERMINAL_CONFIG'; payload: NodeEditorState['terminalConfig'] }
    | { type: 'SET_LAST_SAVED'; payload: Date | null }
    | { type: 'SET_IS_AUTO_SAVING'; payload: boolean }
    | { type: 'SET_HAS_UNSAVED_CHANGES'; payload: boolean }
    | { type: 'SET_AUTO_SAVE_ENABLED'; payload: boolean };

export const initialState: NodeEditorState = {
    sidebarVisible: localStorage.getItem('canvas_sidebar') !== 'false',
    showExportModal: false,
    showUnsavedModal: false,
    showImportModal: false,
    terminalConfig: null,
    lastSaved: null,
    isAutoSaving: false,
    hasUnsavedChanges: false,
    autoSaveEnabled: false,
};

export function nodeEditorReducer(state: NodeEditorState, action: NodeEditorAction): NodeEditorState {
    switch (action.type) {
        case 'SET_SIDEBAR_VISIBLE':
            return { ...state, sidebarVisible: action.payload };
        case 'SET_SHOW_EXPORT_MODAL':
            return { ...state, showExportModal: action.payload };
        case 'SET_SHOW_UNSAVED_MODAL':
            return { ...state, showUnsavedModal: action.payload };
        case 'SET_SHOW_IMPORT_MODAL':
            return { ...state, showImportModal: action.payload };
        case 'SET_TERMINAL_CONFIG':
            return { ...state, terminalConfig: action.payload };
        case 'SET_LAST_SAVED':
            return { ...state, lastSaved: action.payload };
        case 'SET_IS_AUTO_SAVING':
            return { ...state, isAutoSaving: action.payload };
        case 'SET_HAS_UNSAVED_CHANGES':
            return { ...state, hasUnsavedChanges: action.payload };
        case 'SET_AUTO_SAVE_ENABLED':
            return { ...state, autoSaveEnabled: action.payload };
        default:
            return state;
    }
}
