import { useLayoutEffect } from "react";
import {
    RepeatWrapping,
    SRGBColorSpace,
    Vector2,
    type BufferGeometry,
    type Texture,
} from "three";
import { TrackSurface, useKtx2 } from "@spawnite/engine";
import type { SledMap } from "../maps";
import { TerrainMaterial } from "./TerrainMaterial";

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

interface SlopeProps {
    geometry: BufferGeometry;
    /** The map whose tiles and colours it is drawn in. */
    map: SledMap;
}

/** The run's drawn surface: snow and ice, the fence and the hillside, and
 *  the land out to the horizon, in one mesh with a material per zone. It
 *  is the ground, so it takes the sun's shadows and casts none.
 *  ponytail: the old sled's snow shader adds a coarse second normal sample
 *  and a sparkle; a stock material until the run is judged up close. */
export function Slope({ geometry, map }: SlopeProps) {
    const tiles = {
        snow: useTile(map.tiles.snow.color, true),
        snowNormal: useTile(map.tiles.snow.normal, false),
        ice: useTile(map.tiles.ice.color, true),
        iceNormal: useTile(map.tiles.ice.normal, false),
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
                        roughness={map.tiles.snow.roughness}
                        color={map.albedo}
                        emissive={map.emissive}
                        vertexColors
                    />
                ),
                ice: (
                    <meshStandardMaterial
                        map={tiles.ice}
                        normalMap={tiles.iceNormal}
                        normalScale={normalScale}
                        roughness={map.tiles.ice.roughness}
                        color={map.albedo}
                        vertexColors
                    />
                ),
                terrain: <TerrainMaterial map={map} />,
            }}
        />
    );
}
