import { Button, ButtonVariant, Modal, Text } from "@spawnite/engine";
import { dialogLook, paneLook, primaryLook } from "./classes";
import { useChoice } from "../store/choice";
import { Board } from "./Board";

/** The board on its own, over the lobby or the death screen. */
export function BoardScreen() {
    const open = useChoice((state) => state.board);
    const nickname = useChoice((state) => state.nickname);
    const back = () => useChoice.setState({ board: false });
    return (
        <Modal
            className={paneLook}
            dialogClassName={dialogLook}
            open={open}
            pause
            title="Leaderboard"
            overline="BEST RUNS"
            onClose={back}
            actions={
                <Button
                    className={`${primaryLook} flex-1`}
                    variant={ButtonVariant.Accent}
                    onPress={back}
                >
                    Back
                </Button>
            }
        >
            <Text as="div" className="df-pane df-text df-wide">
                <Board you={nickname} />
            </Text>
        </Modal>
    );
}
