import { Workspace } from '../../types';

export interface DashboardState {
    isModalOpen: boolean;
    modalMode: 'create' | 'edit';
    editingWorkspace: Workspace | undefined;
    workspaceToDelete: Workspace | null;
    isDropdownOpen: boolean;
    searchTerm: string;
}

export type DashboardAction =
    | { type: 'OPEN_CREATE_MODAL' }
    | { type: 'OPEN_EDIT_MODAL'; workspace: Workspace }
    | { type: 'CLOSE_MODAL' }
    | { type: 'SET_WORKSPACE_TO_DELETE'; workspace: Workspace | null }
    | { type: 'TOGGLE_DROPDOWN' }
    | { type: 'SET_DROPDOWN'; isOpen: boolean }
    | { type: 'SET_SEARCH_TERM'; term: string };

export const initialState: DashboardState = {
    isModalOpen: false,
    modalMode: 'create',
    editingWorkspace: undefined,
    workspaceToDelete: null,
    isDropdownOpen: false,
    searchTerm: '',
};

export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
    switch (action.type) {
        case 'OPEN_CREATE_MODAL':
            return {
                ...state,
                isModalOpen: true,
                modalMode: 'create',
                editingWorkspace: undefined
            };
        case 'OPEN_EDIT_MODAL':
            return {
                ...state,
                isModalOpen: true,
                modalMode: 'edit',
                editingWorkspace: action.workspace
            };
        case 'CLOSE_MODAL':
            return {
                ...state,
                isModalOpen: false,
                editingWorkspace: undefined
            };
        case 'SET_WORKSPACE_TO_DELETE':
            return {
                ...state,
                workspaceToDelete: action.workspace
            };
        case 'TOGGLE_DROPDOWN':
            return {
                ...state,
                isDropdownOpen: !state.isDropdownOpen
            };
        case 'SET_DROPDOWN':
            return {
                ...state,
                isDropdownOpen: action.isOpen
            };
        case 'SET_SEARCH_TERM':
            return {
                ...state,
                searchTerm: action.term
            };
        default:
            return state;
    }
}
