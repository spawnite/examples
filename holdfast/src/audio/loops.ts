/** A loop of `samples` whose last `fadeLength` samples are blended into
 *  its first, at equal power, and cut from its end: the loop's last sample
 *  runs on into its first as the recording ran on. A recording that is no
 *  loop, and an MP3's padding at either end, then play with no click. */
export function blendLoopSeam(samples: Float32Array, fadeLength: number) {
    const length = samples.length - fadeLength;
    const loop = samples.slice(0, length);
    for (let index = 0; index < fadeLength; index++) {
        const headShare = index / fadeLength;
        loop[index] =
            samples[index] * Math.sqrt(headShare) +
            samples[length + index] * Math.sqrt(1 - headShare);
    }
    return loop;
}
