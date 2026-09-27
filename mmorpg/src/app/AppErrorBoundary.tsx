import type { PropsWithChildren } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button, Text } from "@spawnite/ui";

/** Catches what fails before Game's own boundary stands: the lazy chunk the
 *  game is in, which a deploy can remove from under an open tab. */
export function AppErrorBoundary({ children }: PropsWithChildren) {
    return (
        <ErrorBoundary
            fallbackRender={({ error }) => {
                if (import.meta.env.DEV) throw error;

                return (
                    <>
                        <Text as="p">
                            Something went wrong. Please reload the page.
                        </Text>
                        <Button onPress={() => window.location.reload()}>
                            Reload
                        </Button>
                    </>
                );
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
