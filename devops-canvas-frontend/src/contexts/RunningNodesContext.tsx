import React, { createContext, useContext } from 'react';

const RunningNodesContext = createContext<Set<string> | undefined>(undefined);

export function RunningNodesProvider({
    runningNodeIds,
    children,
}: {
    runningNodeIds: Set<string>;
    children: React.ReactNode;
}) {
    return (
        <RunningNodesContext.Provider value={runningNodeIds}>
            {children}
        </RunningNodesContext.Provider>
    );
}

export function useRunningNodeIds(): Set<string> | undefined {
    return useContext(RunningNodesContext);
}
