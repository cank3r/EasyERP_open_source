define([
        'text!templates/Filter/FilterTemplate.html',
        'text!templates/Filter/filterFavourites.html',
        'views/Filter/FilterValuesView',
        'views/Filter/savedFiltersView',
        'collections/Filter/filterCollection',
        'custom',
        'common',
        'constants',
        'models/UsersModel',
        'dataService'
    ],
    function (ContentFilterTemplate, savedFilterTemplate, valuesView, savedFiltersView, filterValuesCollection, Custom, Common, CONSTANTS, usersModel, dataService) {
        var FilterView;
        FilterView = Backbone.View.extend({
            el          : '#searchContainer',
            contentType : "Filter",
            savedFilters: {},
            filterIcons : {},
            template    : _.template(ContentFilterTemplate),

            events: {
                "mouseover .search-content"     : 'showSearchContent',
                "click .search-content"         : 'showSearchContent',
                "click .filter-dialog-tabs .btn": 'showFilterContent',
                'click #applyFilter'            : 'applyFilter',
                'click .condition li'           : 'conditionClick',
                'click .groupName'              : 'showHideValues',
                "click .filterValues li"        : "selectValue",
                "click .filters"                : "useFilter",
                "click #saveFilterButton"       : "saveFilter",
                "click .removeSavedFilter"      : "removeFilterFromDB",
                "click .removeValues"           : "removeFilter"
            },

            initialize: function (options) {
                this.parentContentType = options.contentType;
                this.viewType = options.viewType;
                this.constantsObject = CONSTANTS.FILTERS[this.parentContentType];

                App.filter = {};

                this.currentCollection = {};
                this.searchRessult = [];

                if (App.savedFilters[this.parentContentType]) {
                    this.savedFilters = App.savedFilters[this.parentContentType];
                }

                this.parseFilter();

                this.setDbOnce = _.debounce(
                    function () {
                        this.trigger('filter', App.filter)
                    }, 500);
            },

            useFilter: function (e) {
                var target = $(e.target);
                var savedFilters;
                var self = this;
                var length;
                var targetId = target.attr('id');
                var keys;

                dataService.getData('/currentUser', null, function (response) {
                    if (response && !response.error) {
                        App.currentUser = response.user;
                        App.savedFilters = response.savedFilters;

                        length = App.savedFilters[self.parentContentType].length;
                        savedFilters = App.savedFilters[self.parentContentType];
                        for (var i = length - 1; i >= 0; i--) {
                            if (savedFilters[i]['_id']['_id'] === targetId) {
                                keys = Object.keys(savedFilters[i]['_id']['filter']);
                                App.filter = savedFilters[i]['_id']['filter'][keys[0]];
                            }
                        }

                        self.selectedFilter(targetId);

                        self.trigger('filter', App.filter);
                        self.renderFilterContent();
                        self.showFilterIcons(App.filter);
                    } else {
                        console.log('can\'t get savedFilters');
                    }
                });

            },

            cloneFilter: function (filter) {
                var newFilter = {};
                var filterKeys = Object.keys(filter);
                var filterKey;
                var filterValue;
                var newFilterValue = [];

                _.forEach(filterKeys, function (filterkey) {
                    filterKey = filter[filterkey]['key'];
                    newFilterValue = [];
                    if (filterKey) {
                        filterValue = filter[filterkey]['value'];
                        for (var i = filterValue.length - 1; i >= 0; i--) {
                            newFilterValue.push(filterValue[i]);
                        }
                    } else {
                        filterKey = 'letter';
                        newFilterValue = filter[filterkey];
                    }
                    newFilter[filterkey] = {
                        key  : filterKey,
                        value: newFilterValue
                    };
                });

                return newFilter;
            },

            saveFilter: function () {
                var currentUser = new usersModel(App.currentUser);
                var key;
                var id;
                var filterObj = {};
                var mid = 39;
                var filterName = this.$el.find('#forFilterName').val();
                var byDefault = this.$el.find('.defaultFilter').prop('checked') ? this.parentContentType : "";
                var viewType = this.viewType ? this.viewType : "";
                var bool = true;
                var self = this;
                var filters;
                var favouritesContent = this.$el.find('#favoritesContent');
                var filterForSave = {};
                var updatedInfo = {};
                var allFilterNames = this.$el.find('.filters');
                var allowName = true;

                _.forEach(allFilterNames, function (filter) {
                    if (filter.innerHTML === filterName) {
                        return allowName = false;
                    }
                });

                key = this.parentContentType;

                filterForSave[filterName] = self.cloneFilter(App.filter);

                if (!App.savedFilters[this.parentContentType]) {
                    App.savedFilters[this.parentContentType] = [];
                }

                if (!allowName) {
                    alert('Filter with same name already exists! Please, change filter name.');
                    bool = false;
                }

                if ((Object.keys(App.filter)).length === 0) {
                    alert('Please, use some filter!');
                    bool = false;
                }

                if (bool && filterName.length > 0) {
                    filterObj['filter'] = {};
                    filterObj['filter'][filterName] = {};
                    filterObj['filter'][filterName] = App.filter;
                    filterObj['key'] = key;
                    filterObj['useByDefault'] = byDefault;
                    filterObj['viewType'] = viewType;

                    currentUser.changed = filterObj;

                    currentUser.save(
                        filterObj,
                        {
                            headers : {
                                mid: mid
                            },
                            wait    : true,
                            patch   : true,
                            validate: false,
                            success : function (model) {
                                updatedInfo = model.get('success');
                                filters = updatedInfo['savedFilters'];
                                length = filters.length;
                                id = filters[length - 1]['_id'];
                                App.savedFilters[self.parentContentType].push(
                                    {
                                        _id      : {
                                            _id        : id,
                                            contentView: key,
                                            filter     : filterForSave
                                        },
                                        byDefault: byDefault,
                                        viewType : viewType
                                    }
                                );
                                favouritesContent.append('<li class="filters"  id ="' + id + '">' + filterName + '</li><button class="removeSavedFilter" id="' + id + '">' + 'x' + '</button>');
                                self.$el.find('.defaultFilter').attr('checked', false);
                                self.selectedFilter(id);
                            },
                            error   : function (model, xhr) {
                                console.error(xhr);
                            },
                            editMode: false
                        });

                    this.$el.find('#forFilterName').val('');
                }
            },

            removeFilterFromDB: function (e) {
                var currentUser = new usersModel(App.currentUser);
                var filterObj = {};
                var mid = 39;
                var savedFilters = App.savedFilters[this.parentContentType];
                var filterID = $(e.target).attr('id'); //chosen current filter id
                var i = 0;

                filterObj['deleteId'] = filterID;
                filterObj['byDefault'] = this.parentContentType;

                currentUser.changed = filterObj;

                currentUser.save(
                    filterObj,
                    {
                        headers : {
                            mid: mid
                        },
                        wait    : true,
                        patch   : true,
                        validate: false,
                        success : function (model) {
                        },
                        error   : function (model, xhr) {
                            console.error(xhr);
                        },
                        editMode: false
                    }
                );

                $.find('#' + filterID)[0].remove();
                $.find('#' + filterID)[0].remove();

                for (var i = savedFilters.length - 1; i >= 0; i--) {
                    if (savedFilters[i]['_id']['_id'] === filterID) {
                        App.savedFilters[this.parentContentType].splice(i, 1);
                    }
                }
            },

            selectValue: function (e) {
                var currentElement = $(e.target);
                var currentValue = currentElement.attr('data-value');
                var filterGroupElement = currentElement.closest('.filterGroup');
                var groupType = filterGroupElement.attr('data-value');
                var groupNameElement = filterGroupElement.find('.groupName')
                var constantsName = $.trim(groupNameElement.text());
                var filterObjectName = this.constantsObject[constantsName].view;
                var currentCollection = this.currentCollection[filterObjectName];
                var collectionElement;
                var intVal;
                var index;

                currentElement.toggleClass('checkedValue');

                intVal = parseInt(currentValue);

                currentValue = (isNaN(intVal) || currentValue.length === 24) ? currentValue : intVal;

                collectionElement = currentCollection.findWhere({_id: currentValue});

                if (currentElement.hasClass('checkedValue')) {

                    if (!App.filter[filterObjectName]) {
                        App.filter[filterObjectName] = {
                            key  : groupType,
                            value: []
                        };
                    }

                    App.filter[filterObjectName]['value'].push(currentValue);
                    collectionElement.set({status: true});

                    groupNameElement.addClass('checkedGroup');

                } else {
                    index = App.filter[filterObjectName]['value'].indexOf(currentValue);

                    if (index >= 0) {
                        App.filter[filterObjectName]['value'].splice(index, 1);
                        collectionElement.set({status: false});

                        if (App.filter[filterObjectName]['value'].length === 0) {
                            delete App.filter[filterObjectName];
                            groupNameElement.removeClass('checkedGroup');
                        }
                    }
                }

                //this.trigger('filter', App.filter);
                this.setDbOnce();
                this.showFilterIcons(App.filter);
            },

            showFilterIcons: function (filter) {
                var filterIc = this.$el.find('.filter-icons');
                var filterValues = this.$el.find('.search-field .oe_searchview_input');
                var filter = Object.keys(filter);
                var self = this;
                var groupName;

                filterValues.empty();
                _.forEach(filter, function (key, value) {
                    groupName = self.$el.find('#' + key).text();
                    if (groupName.length > 0) {
                        filterIc.addClass('active');
                        filterValues.append('<div class="forFilterIcons"><span class="fa fa-filter funnelIcon"></span><span data-value="' + key + '" class="filterValues">' + groupName + '</span><span class="removeValues">x</span></div>');
                    } else {
                        if (key != 'forSales') {
                            groupName = 'Letter';
                            filterIc.addClass('active');
                            filterValues.append('<div class="forFilterIcons"><span class="fa fa-filter funnelIcon"></span><span data-value="' + 'letter' + '" class="filterValues">' + groupName + '</span><span class="removeValues">x</span></div>');
                        }
                    }
                });
            },

            removeFilter: function (e) {
                var target = $(e.target);
                var groupName = target.prev().text();
                var filterView = target.prev().attr('data-value');

                var valuesArray;
                var collectionElement;

                valuesArray = App.filter[filterView]['value'];

                if (valuesArray) {
                    if (this.currentCollection[filterView].length !== 0) {
                        for (var i = valuesArray.length - 1; i >= 0; i--) {
                            collectionElement = this.currentCollection[filterView].findWhere({_id: valuesArray[i]});
                            collectionElement.set({status: false});
                        }
                    }
                    delete App.filter[filterView];

                    this.renderGroup(groupName);
                } else {
                    delete App.filter['letter'];
                }

                $(e.target).closest('div').remove();

                this.renderFilterContent();
                this.trigger('filter', App.filter);
            },

            showHideValues: function (e) {
                var filterGroupContainer = $(e.target).closest('.filterGroup');

                filterGroupContainer.find('.ulContent').toggleClass('hidden');
                filterGroupContainer.toggleClass('activeGroup');
            },

            renderFilterContent: function () {
                var filtersGroupContainer;
                var self = this;
                var keys = Object.keys(this.constantsObject);
                var containerString;
                var filterBackend;
                var filterView;
                var groupStatus;
                var groupContainer;

                filtersGroupContainer = this.$el.find('#filtersContent');

                if (keys.length) {
                    keys.forEach(function (key) {
                        filterView = self.constantsObject[key].view;
                        filterBackend = self.constantsObject[key].backend;

                        groupContainer = self.$el.find('#' + filterView + 'Container');

                        if (groupContainer.length) {
                            groupStatus = groupContainer.hasClass('hidden');
                        } else {
                            groupStatus = true;
                        }

                        containerString = '<div id="' + filterView + 'FullContainer" data-value="' + filterBackend + '" class="filterGroup"></div>';

                        if (!self.$el.find('#' + filterView).length) {
                            filtersGroupContainer.append(containerString);
                        }
                        self.renderGroup(key, filterView, groupStatus);
                    });
                }
                ;

                this.showFilterIcons(App.filter);
            },

            renderGroup: function (key, filterView, groupStatus) {
                var itemView;
                var idString = '#' + filterView + 'FullContainer';
                var container = this.$el.find(idString);
                var status;
                var self = this;
                var mapData;

                if (!App.filtersValues || !App.filtersValues[self.parentContentType]) {
                    return setTimeout(function () {
                        self.renderGroup(key, filterView, groupStatus);
                    }, 10);
                }

                this.filterObject = App.filtersValues[this.parentContentType];

                mapData = _.map(this.filterObject[filterView], function (dataItem) {
                    return {category: key, value: dataItem.name, data: dataItem._id};
                })

                this.searchRessult = this.searchRessult.concat(mapData);

                this.currentCollection[filterView] = new filterValuesCollection(this.filterObject[filterView]);

                if (App.filter[filterView]) {
                    this.setStatus(filterView);
                    status = true;
                } else {
                    status = false;
                }

                itemView = new valuesView({
                    groupStatus      : groupStatus,
                    parentContentType: this.parentContentType,
                    element          : idString,
                    status           : status,
                    groupName        : key,
                    groupViewName    : filterView,
                    currentCollection: this.currentCollection[filterView]
                });

                container.html('');
                container.html(itemView.render());
            },

            render: function () {
                var currentEl = this.$el;
                var searchInput;

                currentEl.html(this.template({filterCollection: this.constantsObject}));

                this.renderFilterContent();

                this.renderSavedFilters();

                $.widget("custom.catcomplete", $.ui.autocomplete, {
                    _create    : function () {
                        this._super();
                        this.widget().menu("option", "items", "> :not(.ui-autocomplete-category)");
                    },
                    _renderMenu: function (ul, items) {
                        var that = this,
                            currentCategory = "";
                        $.each(items, function (index, item) {
                            var li;
                            if (item.category != currentCategory) {
                                ul.append("<li class='ui-autocomplete-category'>" + item.category + "</li>");
                                currentCategory = item.category;
                            }
                            li = that._renderItemData(ul, item);
                            if (item.category) {
                                li.attr("aria-label", item.category + " : " + item.label);
                            }
                        });
                    }
                });

                searchInput = currentEl.find("#mainSearch");

                searchInput.catcomplete({
                    source   : this.searchRessult
                });

                return this;
            },

            renderSavedFilters: function () {
                var contentType = this.parentContentType;
                var self = this;
                var keys;
                var filterId;
                var filterByDefault;
                var viewType;

                this.$el.find('#favoritesContent').append(_.template(savedFilterTemplate));

                var content = this.$el.find('#favoritesContent');

                if (App.savedFilters[contentType]) {
                    this.savedFilters = App.savedFilters[contentType];

                    for (var j = this.savedFilters.length - 1; j >= 0; j--) {
                        if (this.savedFilters[j]) {
                            if (this.savedFilters[j].byDefault === contentType) {
                                keys = Object.keys(this.savedFilters[j]['_id']['filter']);

                                filter = this.savedFilters[j]['_id']['filter'][keys[0]];

                                App.filter = filter;

                                if (this.savedFilters[j].viewType) {
                                    viewType = this.savedFilters[j].viewType;
                                }

                                self.trigger('filter', App.filter, viewType);
                                self.renderFilterContent();
                                self.showFilterIcons(App.filter);
                                filterId = this.savedFilters[j]['_id']['_id'];

                                if (typeof (filterId) === 'object') {
                                    filterByDefault = filterId._id;
                                }
                            }

                            filterId = this.savedFilters[j]['_id']['_id'];

                            keys = Object.keys(this.savedFilters[j]['_id']['filter']);
                            for (var i = keys.length - 1; i >= 0; i--) {
                                content.append('<li class="filters"  id ="' + filterId + '">' + keys[i] + '</li><button class="removeSavedFilter" id="' + filterId + '">' + 'x' + '</button>');
                            }
                        }
                    }
                }

                this.$el.find('#favoritesContent').append(content);
                self.selectedFilter(filterByDefault);
            },

            selectedFilter: function (filterId) {
                var filterName = this.$el.find('#' + filterId);
                var filterNames = this.$el.find('.filters');

                if (filterId) {

                    filterNames.removeClass('checkedValue');

                    filterName.addClass('checkedValue');
                }
            },

            parseFilter: function () {
                var browserString = window.location.hash;
                var browserFilter = browserString.split('/filter=')[1];

                App.filter = (browserFilter) ? JSON.parse(decodeURIComponent(browserFilter)) : {};
            },

            setStatus: function (filterKey) {
                var valuesArray;
                var collectionElement;

                valuesArray = App.filter[filterKey]['value'];

                if (this.currentCollection[filterKey].length === 0) {
                    return;
                }
                for (var i = valuesArray.length - 1; i >= 0; i--) {
                    collectionElement = this.currentCollection[filterKey].findWhere({_id: valuesArray[i]});
                    collectionElement.set({status: true});
                }
            },

            //applyFilter: function () {
            //    this.trigger('filter', App.filter);
            //},

            showSearchContent: function () {
                var el = this.$el.find('.search-content');
                var searchOpt = this.$el.find('.search-options');
                var selector = 'fa-caret-up';

                searchOpt.removeClass('hidden');

                if (el.hasClass(selector)) {
                    el.removeClass(selector);
                    this.$el.find('.search-options').addClass('hidden');
                } else {
                    el.addClass(selector)
                }
            },

            showFilterContent: function (e) {
                var currentValue = $(e.target).attr('data-value');

                this.$el.find(currentValue)
                    .removeClass('hidden')
                    .siblings()
                    .addClass('hidden');

            }
        });

        return FilterView;
    });