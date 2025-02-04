'use strict'

/**
 * @module Assertions
 */

import { expect, use } from 'chai'
import moment from 'moment-timezone'
import * as Cast from './cast.js'
import { registerChaiAssertion } from './custom_chai_assertions.js'
import { isEmpty, getValue } from '../utils/index.js'

use(registerChaiAssertion)

const negationRegex = `!|! |not |does not |doesn't |is not |isn't `
const matchRegex = new RegExp(`^(${negationRegex})?(match|matches|~=)$`)
const containRegex = new RegExp(`^(${negationRegex})?(contains?|\\*=)$`)
const startWithRegex = new RegExp(`^(${negationRegex})?(starts? with|\\^=)$`)
const endWithRegex = new RegExp(`^(${negationRegex})?(ends? with|\\$=)$`)
const presentRegex = new RegExp(`^(${negationRegex})?(defined|present|\\?)$`)
const equalRegex = new RegExp(`^(${negationRegex})?(equals?|=)$`)
const typeRegex = new RegExp(`^(${negationRegex})?(type|#=)$`)
const relativeDateRegex = new RegExp(`^(${negationRegex})?(equalRelativeDate)$`)
const relativeDateValueRegex = /^(\+?\d|-?\d),([A-Za-z]+),([A-Za-z-]{2,5}),(.+)$/

const RuleName = Object.freeze({
    Match: Symbol('match'),
    Contain: Symbol('contain'),
    StartWith: Symbol('startWith'),
    EndWith: Symbol('endWith'),
    Present: Symbol('present'),
    Equal: Symbol('equal'),
    Type: Symbol('type'),
    RelativeDate: Symbol('relativeDate'),
})

/**
 * Count object properties including nested objects ones.
 * If a property is an object, its key is ignored.
 *
 * @example
 * Assertions.countNestedProperties({
 *     a: true,
 *     b: true,
 *     c: true,
 * })
 * // => 3
 * Assertions.countNestedProperties({
 *     a: true,
 *     b: true,
 *     c: {
 *         a: true,
 *         b: true,
 *     },
 * })
 * // => 4 (c is ignored because it's a nested object)
 *
 * @param {Object} object
 * @return {number}
 */
export const countNestedProperties = (object) => {
    let propertiesCount = 0
    Object.keys(object).forEach((key) => {
        if (!isEmpty(object[key]) && typeof object[key] === 'object') {
            const count = countNestedProperties(object[key])
            propertiesCount += count
        } else {
            propertiesCount++
        }
    })

    return propertiesCount
}

/**
 * @typedef {object} ObjectFieldSpec
 * @property {string} field
 * @property {string} matcher
 * @property {string} value
 */

/**
 * Check that an object matches given specification.
 * specification must be defined as an array of ObjectFieldSpec.
 *
 * @example
 * Assertions.assertObjectMatchSpec(
 *     // object to check
 *     {
 *         first_name: 'Raoul',
 *         last_name: 'Marcel'
 *     },
 *     // spec
 *     [
 *         {
 *             field: 'first_name',
 *             matcher: 'equals',
 *             value: 'Raoul'
 *         },
 *         {
 *             field: 'last_name',
 *             matcher: 'equals',
 *             value: 'Dupond'
 *         },
 *     ]
 * )
 * // Will throw because last_name does not equal 'Dupond'.
 *
 * @see ObjectFieldSpec
 *
 * @param {object}            object        - object to test
 * @param {ObjectFieldSpec[]} spec          - specification
 * @param {boolean}           [exact=false] - if `true`, specification must match all object's properties
 */
export const assertObjectMatchSpec = (object, spec, exact = false) => {
    spec.forEach(({ field, matcher, value }) => {
        const currentValue = getValue(object, field)
        const expectedValue = Cast.getCastedValue(value)

        const rule = getMatchingRule(matcher)

        switch (rule.name) {
            case RuleName.Match: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' (${currentValue}) ${
                        rule.isNegated ? 'matches' : 'does not match'
                    } '${expectedValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.match(new RegExp(expectedValue))
                } else {
                    baseExpect.to.match(new RegExp(expectedValue))
                }
                break
            }
            case RuleName.Contain: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' (${currentValue}) ${
                        rule.isNegated ? 'contains' : 'does not contain'
                    } '${expectedValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.contain(expectedValue)
                } else {
                    baseExpect.to.contain(expectedValue)
                }
                break
            }
            case RuleName.StartWith: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' (${currentValue}) ${
                        rule.isNegated ? 'starts with' : 'does not start with'
                    } '${expectedValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.startWith(expectedValue)
                } else {
                    baseExpect.to.startWith(expectedValue)
                }
                break
            }
            case RuleName.EndWith: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' (${currentValue}) ${
                        rule.isNegated ? 'ends with' : 'does not end with'
                    } '${expectedValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.endWith(expectedValue)
                } else {
                    baseExpect.to.endWith(expectedValue)
                }
                break
            }
            case RuleName.Present: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' is ${rule.isNegated ? 'defined' : 'undefined'}`,
                )
                if (rule.isNegated) {
                    baseExpect.to.be.undefined
                } else {
                    baseExpect.to.not.be.undefined
                }
                break
            }
            case RuleName.RelativeDate: {
                const match = relativeDateValueRegex.exec(expectedValue)
                if (match === null) throw new Error('relative date arguments are invalid')
                const [, amount, unit, locale, format] = match
                const normalizedLocale = Intl.getCanonicalLocales(locale)[0]
                const expectedDate = moment()
                    .add(amount, unit)
                    .locale(normalizedLocale)
                    .format(format)
                const baseExpect = expect(
                    currentValue,
                    `Expected property '${field}' to ${
                        rule.isNegated ? 'not ' : ''
                    }equal '${expectedDate}', but found '${currentValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.be.deep.equal(expectedDate)
                } else {
                    baseExpect.to.be.deep.equal(expectedDate)
                }
                break
            }
            case RuleName.Type: {
                const baseExpect = expect(
                    currentValue,
                    `Property '${field}' (${currentValue}) type is${
                        rule.isNegated ? '' : ' not'
                    } '${expectedValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.be.a(expectedValue)
                } else {
                    baseExpect.to.be.a(expectedValue)
                }
                break
            }
            case RuleName.Equal: {
                const baseExpect = expect(
                    currentValue,
                    `Expected property '${field}' to${
                        rule.isNegated ? ' not' : ''
                    } equal '${value}', but found '${currentValue}'`,
                )
                if (rule.isNegated) {
                    baseExpect.to.not.be.deep.equal(expectedValue)
                } else {
                    baseExpect.to.be.deep.equal(expectedValue)
                }
                break
            }
        }
    })

    // We check we have exactly the same number of properties as expected
    if (exact === true) {
        const propertiesCount = countNestedProperties(object)
        expect(
            propertiesCount,
            'Expected json response to fully match spec, but it does not',
        ).to.be.equal(spec.length)
    }
}

/**
 * Get a rule matching the given matcher.
 * If it didn't match, it returns undefined.
 *
 * @example
 * Assertions.getMatchingRule(`doesn't match`)
 * // => { name: 'match', isNegated: true }
 * Assertions.getMatchingRule(`contains`)
 * // => { name: 'contain', isNegated: false }
 * Assertions.getMatchingRule(`unknown matcher`)
 * // => undefined
 * @typedef {Object} Rule
 * @property {symbol} name - The name of the rule matched
 * @property {boolean} isNegated - Whether the matcher is negated or not
 * @param {string} matcher
 * @return {Rule} the result of the matching
 */
export const getMatchingRule = (matcher) => {
    const matchGroups = matchRegex.exec(matcher)
    if (matchGroups) {
        return { name: RuleName.Match, isNegated: !!matchGroups[1] }
    }

    const containGroups = containRegex.exec(matcher)
    if (containGroups) {
        return { name: RuleName.Contain, isNegated: !!containGroups[1] }
    }

    const startWithGroups = startWithRegex.exec(matcher)
    if (startWithGroups) {
        return { name: RuleName.StartWith, isNegated: !!startWithGroups[1] }
    }

    const endWithGroups = endWithRegex.exec(matcher)
    if (endWithGroups) {
        return { name: RuleName.EndWith, isNegated: !!endWithGroups[1] }
    }

    const presentGroups = presentRegex.exec(matcher)
    if (presentGroups) {
        return { name: RuleName.Present, isNegated: !!presentGroups[1] }
    }

    const equalGroups = equalRegex.exec(matcher)
    if (equalGroups) {
        return { name: RuleName.Equal, isNegated: !!equalGroups[1] }
    }

    const typeGroups = typeRegex.exec(matcher)
    if (typeGroups) {
        return { name: RuleName.Type, isNegated: !!typeGroups[1] }
    }

    const relativeDateGroups = relativeDateRegex.exec(matcher)
    if (relativeDateGroups) {
        return { name: RuleName.RelativeDate, isNegated: !!relativeDateGroups[1] }
    }

    expect.fail(`Matcher "${matcher}" did not match any supported assertions`)
}
