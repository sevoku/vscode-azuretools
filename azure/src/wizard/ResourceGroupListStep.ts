/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceManagementClient, ResourceManagementModels } from '@azure/arm-resources';
import * as types from '../../index';
import { createResourcesClient } from '../clients';
import { localize } from '../localize';
import { uiUtils } from '../utils/uiUtils';
import { AzureWizardPromptStep, IAzureNamingRules, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions } from 'vscode-azureextensionui';
import { LocationListStep } from './LocationListStep';
import { ResourceGroupCreateStep } from './ResourceGroupCreateStep';
import { ResourceGroupNameStep } from './ResourceGroupNameStep';
import { nonNullProp } from '@microsoft/vscode-azext-utils';

export const resourceGroupNamingRules: IAzureNamingRules = {
    minLength: 1,
    maxLength: 90,
    invalidCharsRegExp: /[^a-zA-Z0-9\.\_\-\(\)]/
};

export class ResourceGroupListStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> implements types.ResourceGroupListStep<T> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public static async getResourceGroups<T extends types.IResourceGroupWizardContext>(wizardContext: T): Promise<ResourceManagementModels.ResourceGroup[]> {
        if (wizardContext.resourceGroupsTask === undefined) {
            const client: ResourceManagementClient = await createResourcesClient(wizardContext);
            wizardContext.resourceGroupsTask = uiUtils.listAll(client.resourceGroups, client.resourceGroups.list());
        }

        return await wizardContext.resourceGroupsTask;
    }

    public static async isNameAvailable<T extends types.IResourceGroupWizardContext>(wizardContext: T, name: string): Promise<boolean> {
        const resourceGroupsTask: Promise<ResourceManagementModels.ResourceGroup[]> = ResourceGroupListStep.getResourceGroups(wizardContext);
        return !(await resourceGroupsTask).some((rg: ResourceManagementModels.ResourceGroup) => rg.name !== undefined && rg.name.toLowerCase() === name.toLowerCase());
    }

    public async prompt(wizardContext: T): Promise<void> {
        // Cache resource group separately per subscription
        const options: IAzureQuickPickOptions = { placeHolder: 'Select a resource group for new resources.', id: `ResourceGroupListStep/${wizardContext.subscriptionId}` };
        wizardContext.resourceGroup = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.resourceGroup) {
            const promptSteps: AzureWizardPromptStep<T>[] = [new ResourceGroupNameStep()];
            LocationListStep.addStep(wizardContext, promptSteps);

            return {
                promptSteps,
                executeSteps: [new ResourceGroupCreateStep()]
            };
        } else {
            wizardContext.valuesToMask.push(nonNullProp(wizardContext.resourceGroup, 'name'));
            return undefined;
        }
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.resourceGroup && !wizardContext.newResourceGroupName;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<ResourceManagementModels.ResourceGroup | undefined>[]> {
        const picks: IAzureQuickPickItem<ResourceManagementModels.ResourceGroup | undefined>[] = [];

        if (!this._suppressCreate) {
            picks.push({
                label: localize('NewResourceGroup', '$(plus) Create new resource group'),
                description: '',
                data: undefined
            });
        }

        const resourceGroups: ResourceManagementModels.ResourceGroup[] = (await ResourceGroupListStep.getResourceGroups(wizardContext)).sort((a, b) => {
            const nameA: string = nonNullProp(a, 'name');
            const nameB: string = nonNullProp(b, 'name');
            if (nameA > nameB) {
                return 1;
            } else if (nameA < nameB) {
                return -1;
            } else {
                return 0;
            }
        });

        return picks.concat(resourceGroups.map((rg: ResourceManagementModels.ResourceGroup) => {
            return {
                id: rg.id,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: rg.name!,
                description: rg.location,
                data: rg
            };
        }));
    }
}
