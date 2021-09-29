import {Palette} from "color-thief-node";

export interface ImageApiDTO {
    objectID: number
    // title: string
    primaryImageSmall: string
    // artistDisplayName: string
}

export enum PrimaryColors {
    Red = 'Red',
    Green = 'Green',
    Blue = 'Blue',
    None = 'None'
}

export interface ImageInfo extends ImageApiDTO{
    color: Palette
}

export interface ProcessedImage extends ImageApiDTO{
    dominantColor: string,
    dominantPrimaryColor: PrimaryColors
}

export interface ImageResponseDTO {
    images: ProcessedImage[]
}