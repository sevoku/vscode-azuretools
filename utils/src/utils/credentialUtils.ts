/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApplicationSubscription } from '../../hostapi.v2';
import { AzExtServiceClientCredentials, ISubscriptionContext } from '../../index';
import { localize } from '../localize';

/**
 * Converts a VS Code authentication session to an Azure Track 1 & 2 compatible compatible credential.
 */
export function createCredential(getSession: (scopes?: string[]) => vscode.ProviderResult<vscode.AuthenticationSession>): AzExtServiceClientCredentials {
    return {
        getToken: async (scopes?: string | string[]) => {
            if (typeof scopes === 'string') {
                scopes = [scopes];
            }

            const session = await getSession(scopes);

            if (session) {
                return {
                    token: session.accessToken
                };
            } else {
                return null;
            }
        },
        signRequest: async () => {
            throw new Error((localize('signRequestError', 'Track 1 credentials are not (currently) supported.')));
        }
    };
}

/**
 * Creates a subscription context from an application subscription.
 *
 * TODO: expose these utils and remove duplicate code in resource groups + client extensions
 */
export function createSubscriptionContext(subscription: ApplicationSubscription): ISubscriptionContext {
    return {
        subscriptionDisplayName: subscription.displayName,
        userId: '', // TODO
        ...subscription,
        credentials: createCredential(subscription.authentication.getSession)
    };
}