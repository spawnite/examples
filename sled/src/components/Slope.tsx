import { useLayoutEffect } from "react";
import {
    RepeatWrapping,
    SRGBColorSpace,
    Vector2,
    type BufferGeometry,
    type Texture,
} from "three";
import { TrackSurface, useKtx2 } from "@spawnite/engine";
import ice from "@spawnite/assets/textures/sled/ice.ktx2?url";
import iceNormal from "@spawnite/assets/textures/sled/ice-n.ktx2?url";
import snow from "@spawnite/assets/textures/sled/snow.ktx2?url";
import snowNormal from "@spawnite/assets/textures/sled/snow-n.ktx2?url";
import { palette } from "../palette";
import { TerrainMaterial } from "./TerrainMaterial";

//  Roughness is all that parts snow from ice. Ice at 0.45 rather than
//  near-mirror: a narrow lobe reflects the horizon, and the lane went the
//  colour of the sky whenever the sky changed.
const snowRoughness = 0.95;
const iceRoughness = 0.45;
//  The geometry carries the drift, so the tile's normal is only the fine
//  wind grain the chase camera rakes across.
const normalScale = new Vector2(0.1, 0.1);

/** A ground tile, wrapped: the surface's uvs run in tiles. */
function useTile(url: string, color: boolean): Texture {
    const texture = useKtx2(url);
    useLayoutEffect(() => {
        texture.wrapS = texture.wrapT = RepeatWrapping;
        if (color) texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
    }, [texture, color]);
    return texture;
}

/** The run's drawn surface: snow and ice, the fence and the hillside, and
 *  the land out to the horizon, in one mesh with a material per zone. It
 *  is the ground, so it takes the sun's shadows and casts none.
 *  ponytail: the old sled's snow shader adds a coarse second normal sample
 *  and a sparkle; a stock material until the run is judged up close. */
export function Slope({ geometry }: { geometry: BufferGeometry }) {
    const tiles = {
        snow: useTile(snow, true),
        snowNormal: useTile(snowNormal, false),
        ice: useTile(ice, true),
        iceNormal: useTile(iceNormal, false),
    };
    return (
        <TrackSurface
            geometry={geometry}
            materials={{
                snow: (
                    <meshStandardMaterial
                        map={tiles.snow}
                        normalMap={tiles.snowNormal}
                        normalScale={normalScale}
                        roughness={snowRoughness}
                        color={palette.snowAlbedo}
                        emissive={palette.snowEmissive}
                        vertexColors
                    />
                ),
                ice: (
                    <meshStandardMaterial
                        map={tiles.ice}
                        normalMap={tiles.iceNormal}
                        normalScale={normalScale}
                        roughness={iceRoughness}
                        color={palette.snowAlbedo}
                        vertexColors
                    />
                ),
                terrain: <TerrainMaterial />,
            }}
        />
    );
}
