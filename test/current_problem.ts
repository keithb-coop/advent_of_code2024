import {filter, foldMap, map, reduce} from "fp-ts/Array";
import {promises as filesystem} from "fs";
import {trimLeft} from "fp-ts/string";

import {Monoid} from "fp-ts/Monoid";

const forAll: Monoid<boolean> = {
    concat: (l: boolean, r:boolean) => l && r,
    empty: true
}

class GameSet {
    numberOf(colour: Colour){
        return this._counts.get(colour)
    }

    readonly _counts: Map<Colour, number>

    constructor(aString: string) {
        this._counts = new Map()
        for (const entry of map(trimLeft)(aString.split(","))) {
            const [theCount, theColour] = entry.split(" ")
            for(const colour of Colours){
                if(colour === theColour){
                    this._counts.set(colour, parseInt(theCount))
                    break
                }
            }
        }
    }

    enoughOfFor(aSet: GameSet) {
        return (colour: Colour) => {
            return (aSet?.numberOf(colour) ?? 0) <= (this?.numberOf(colour) ?? 0)
        }
    }

    couldProvide(possibleSet: GameSet) {
        return foldMap(forAll)(this.enoughOfFor(possibleSet))(Colours)
    }
}



class Game {
    get gameNumber(): string {
        return this._gameNumber;
    }
    private _gameNumber: string = "";

    get numberOfSets() {
        return this._sets.length
    }

    private _sets: any[]

    constructor(input: string) {
        const fields = input.split(':')
        this.populateNumber(fields[0]);
        this._sets = []
        this.populateSets(fields[1])
    }

    private populateNumber(field: string) {
        this._gameNumber = field.split(" ")[1]
    }

    populateSets(input: string) {
        const fields = input.split(';')
        this._sets = map((aString: string) => new GameSet(aString))(fields)
    }

    set(number: number) {
        return this._sets[number]
    }

    gameSetEnoughFor(ballSupply: GameSet){
        return (myGame: GameSet)=>{
            return ballSupply.couldProvide(myGame)
        }
    }

    couldBePlayedWity(ballSupply: GameSet) {
        return foldMap(forAll)(this.gameSetEnoughFor(ballSupply))(this._sets)
    }
}

const Red : "red" = "red"
const Green : "green" = "green"
const Blue : "blue" = "blue"

type Colour = "red" | "green" | "blue"
const Colours:["red", "green", "blue"] = [Red, Green, Blue] // enums are not worth having, they're too non-orthogonal


describe("Advent of Code",()=> {
    describe("2", () => {
        it("parses input lines", () => {
            const input = "Game 3: 8 green, 6 blue, 20 red; 5 blue, 4 red, 13 green; 5 green, 1 red"
            const aGame = new Game(input)
            expect(aGame.gameNumber).toEqual("3")
            expect(aGame.numberOfSets).toEqual(3)
            
            const gameSet = aGame.set(1)
            expect(gameSet.numberOf(Red)).toEqual(4)
            expect(gameSet.numberOf(Green)).toEqual(13)
            expect(gameSet.numberOf(Blue)).toEqual(5)
        })

        it("recognises GameSet validity",()=>{
            const ballSupply = new GameSet("12 red, 13 green, 14 blue")

            const possibleSet = new GameSet("7 red, 12 green, 2 blue")
            expect(ballSupply.couldProvide(possibleSet)).toBeTruthy()

            const impossibleSet = new GameSet("6 red, 14 green, 1 blue")
            expect(ballSupply.couldProvide(impossibleSet)).toBeFalsy()
        })

        it("recognises Game validity",()=> {
            const ballSupply = new GameSet("12 red, 13 green, 14 blue")

            const possibleGame = new Game("Game 1: 10 red, 6 green, 2 blue; 12 red, 13 green, 14 blue")
            expect(possibleGame.couldBePlayedWity(ballSupply)).toBeTruthy()

            const imPossibleGame = new Game("Game 1: 10 red, 16 green, 2 blue; 12 red, 13 green, 14 blue")
            expect(imPossibleGame.couldBePlayedWity(ballSupply)).toBeFalsy()
        })

        it("finds the answer", async () => {
            const rawData = await filesystem.readFile('problem_sets/Day2.txt', 'utf-8')
            const data = rawData.split(/\r?\n/)
            const games = map((aString: string) => new Game(aString))(data)


            const ballSupply = new GameSet("12 red, 13 green, 14 blue")
            const possibleGames = filter((aGame: Game)=>aGame.couldBePlayedWity(ballSupply))(games)
            const result = reduce(0, (accumulator: number, aGame: Game) => accumulator + parseInt(aGame.gameNumber))(possibleGames)
            expect(result).toEqual(2447)
        })
    })
})

export{}