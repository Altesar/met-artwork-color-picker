import {Express, Request, Response, Router} from 'express'
import {RateLimit} from 'async-sema'
import Axios from 'axios'
import {ImageApiDTO, ImageInfo, ImageResponseDTO, PrimaryColors} from "../models/models";
import {getColorFromURL, Palette} from 'color-thief-node'

export class ArtController {
    private readonly path = '/artwork'
    private readonly metBaseUrl = 'https://collectionapi.metmuseum.org/public/collection/v1/'
    private readonly rpsLimit = 80
    private readonly limiter: () => Promise<void>
    private readonly targetDepartmentId = 11 // European Paintings
    private readonly processBatchSize = 200

    constructor(private readonly expressApp: Express) {
        this.bindEndpoints()
        this.limiter = RateLimit(this.rpsLimit)
    }

    private bindEndpoints() {
        const router = Router()
        router.get('/', this.getArtwork.bind(this))
        this.expressApp.use(this.path, router)
    }

    private async getArtwork(req: Request, res: Response) {
        const itemsQueryUrl = this.metBaseUrl + `objects?departmentIds=${this.targetDepartmentId}`

        await this.limiter()

        try {
            const response = await Axios.get(itemsQueryUrl)

            if(response.statusText !== 'OK') {
                console.error('[ArtController::getArtwork]', response.statusText)
                res.statusCode = 500
                res.send({message: response.statusText})
            }

            const items = response.data.objectIDs

            const imageObjects = await this.fetchImageData(items.slice(0, this.processBatchSize))
            const palettes = await this.fetchImageColors(imageObjects)
            const processedList = this.processImages(palettes)

            res.statusCode = 200
            res.send(processedList) // TODO: send artwork.json
        } catch (e) {
            console.error('[ArtController::getArtwork]', e)
            res.statusCode = 500
            res.send({message: 'Something went wrong'})
        }
    }

    private async fetchImageData(objectIds: number[]): Promise<ImageApiDTO[]> {
        const imageQueryUrlBase = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/'

        const images = await Promise.all(
            objectIds.map(async (objectId) => {
                await this.limiter()
                const response = await Axios.get(imageQueryUrlBase + objectId)
                return response.data
            })
        )

        return images.filter(data => !!data && !!data.primaryImageSmall)
    }

    private async fetchImageColors(imageObjects: ImageApiDTO[]): Promise<ImageInfo[]> {
        const pallets = await Promise.all(
            imageObjects.map(async (image) => {
                await this.limiter()
                try {
                    const palette = await getColorFromURL(image.primaryImageSmall, 2)
                    return {
                        ...image,
                        color: palette
                    }
                } catch (e) {
                    return null
                }
            })
        )

        return pallets.filter(data => !!data)
    }

    private processImages(images: ImageInfo[]): ImageResponseDTO {
        const response: ImageResponseDTO = {
            images: []
        }

        const rgbToHex = (current: number) => {
            const currentHex = current.toString(16).toUpperCase()
            return currentHex.length < 2 ? '0' + currentHex : currentHex
        }

        response.images = images.map(image => {
            const isMonochrome = image.color.every(color => color === image.color[0])
            const dominantPrimaryColor = isMonochrome ? PrimaryColors.None : this.getPrimaryColor(image.color)

            return {
                objectID: image.objectID,
                primaryImageSmall: image.primaryImageSmall,
                dominantColor: '#' + image.color.map(rgbToHex).join(''),
                dominantPrimaryColor
            }
        })

        return response
    }

    private getPrimaryColor(color: Palette): PrimaryColors {
        const maxColorValue = Math.max(...color)
        let primaryColor = PrimaryColors.None
        switch(color.indexOf(maxColorValue)) {
            case 0:
                primaryColor = PrimaryColors.Red
                break;
            case 1:
                primaryColor = PrimaryColors.Green
                break;
            case 2:
                primaryColor = PrimaryColors.Blue
                break;
        }

        return primaryColor
    }
}