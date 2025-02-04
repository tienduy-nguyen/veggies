'use strict'

/**
 * @module extensions/fixtures/FixturesLoader
 */

import fs from 'node:fs'
import path from 'node:path'
import fastGlob from 'fast-glob'
import { pathToFileURL } from 'url'
import yaml from 'js-yaml'

/**
 * Fixtures loader extension.
 *
 * @class
 */
class FixturesLoader {
    /**
     * @param {string} [fixturesDir='fixtures'] - The name of the fixtures directory relative to feature
     */
    constructor({ fixturesDir } = { fixturesDir: 'fixtures' }) {
        this.fixturesDir = fixturesDir
        this.featureUri = undefined
    }

    /**
     * Configures the loader
     *
     * @param {string} [fixturesDir='fixtures'] - The name of the fixtures directory relative to feature
     */
    configure({ fixturesDir } = { fixturesDir: 'fixtures' }) {
        this.fixturesDir = fixturesDir
    }

    /**
     * Sets feature uri, used to resolve fixtures files.
     * When trying to load a fixture file the path will be comprised of:
     * - feature uri
     * - fixturesDir
     * - fixture name
     *
     * @param {string} featureUri - Feature uri
     */
    setFeatureUri(featureUri) {
        this.featureUri = featureUri
    }

    /**
     * Loads content from file.
     *
     * @param {string} file - File path
     * @return {Promise.<string>} File content
     */
    loadText(file) {
        return new Promise((resolve, reject) => {
            fs.readFile(file, (err, data) => {
                if (err) return reject(err)
                resolve(data.toString('utf8'))
            })
        })
    }

    /**
     * Loads content from yaml file.
     *
     * @param {string} file - File path
     * @return {Promise.<Object|Array>} Parsed yaml data
     */
    loadYaml(file) {
        return this.loadText(file).then((content) => {
            try {
                const data = yaml.load(content)
                if (data === undefined) {
                    return Promise.reject(
                        new Error(
                            `Fixture file is invalid, yaml parsing resulted in undefined data for file: ${file}`,
                        ),
                    )
                }

                return data
            } catch (err) {
                return Promise.reject(
                    new Error(`Unable to parse yaml fixture file: ${file}.\nerror: ${err.message}`),
                )
            }
        })
    }

    /**
     * Loads content from json file.
     *
     * @param {string} file - File path
     * @return {Promise.<Object>} Json data
     */
    loadJson(file) {
        return this.loadText(file).then((content) => {
            try {
                const data = JSON.parse(content)

                return data
            } catch (err) {
                return Promise.reject(
                    new Error(`Unable to parse json fixture file: ${file}.\nerror: ${err.message}`),
                )
            }
        })
    }

    /**
     * Loads content from javascript module.
     *
     * @param {string} file - File path
     * @return {Promise.<*>} Data generated from the module
     */
    loadModule(file) {
        const moduleURL = pathToFileURL(path.resolve(file)).href

        return import(moduleURL)
            .then((mod) => {
                if (typeof mod.default !== 'function') {
                    return Promise.reject(
                        new Error(
                            [
                                `JavaScript fixture file should export default function.\n`,
                                `Make sure you declared 'export default function' in ${file}`,
                            ].join(''),
                        ),
                    )
                }

                return mod.default()
            })
            .catch((err) => {
                return Promise.reject(
                    new Error(
                        `An error occurred while loading fixture file: ${file}\nerror: ${err.message}`,
                    ),
                )
            })
    }

    /**
     * Tries to load a fixture from current feature directory.
     * Will search for the following file extensions:
     * - yaml
     * - yml
     * - js
     * - json
     * - txt
     *
     * @param {string} fixture - Fixture file name without extension
     * @return {Promise.<Object|string>} Fixture content
     */
    load(fixture) {
        if (this.featureUri === undefined)
            return Promise.reject(
                new Error(`Cannot load fixture: ${fixture}, no feature uri defined`),
            )

        const featureDir = path.dirname(this.featureUri)
        const pattern = `${featureDir}/${this.fixturesDir}/${fixture}.@(yaml|yml|js|json|txt)`

        return new Promise((resolve, reject) => {
            const files = fastGlob.sync(pattern)
            const fixturesCount = files.length

            if (fixturesCount === 0)
                return reject(new Error(`No fixture found for: ${fixture} (${pattern})`))
            if (fixturesCount > 1) {
                return reject(
                    new Error(
                        [
                            `Found ${fixturesCount} matching fixture files, `,
                            `you should have only one matching '${fixture}', matches:\n  `,
                            `- ${files.join('\n  - ')}`,
                        ].join(''),
                    ),
                )
            }

            const fixtureFile = files[0]
            const ext = path.extname(fixtureFile).substring(1)

            switch (ext) {
                case 'yml':
                case 'yaml':
                    return resolve(this.loadYaml(fixtureFile))

                case 'js':
                    return resolve(this.loadModule(fixtureFile))

                case 'json':
                    return resolve(this.loadJson(fixtureFile))

                default:
                    return resolve(this.loadText(fixtureFile))
            }
        })
    }

    /**
     * Resets fixtures loader.
     */
    reset() {
        this.featureUri = undefined
    }
}

/**
 * Create a new isolated fixtures loader
 * @return {FixturesLoader}
 */
export default function (...args) {
    return new FixturesLoader(...args)
}

/**
 * fixtures loader extension.
 * @type {FixturesLoader}
 */
export { FixturesLoader as Fixture }
